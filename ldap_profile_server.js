;
(function() {

  var client;

  if (!Meteor.ldapgroups) {
    Meteor.ldapgroups = new Meteor.Collection("ldapgroups");
  }

  Meteor.publish("ldapgroups", function() {
    if (this.userId) {
      var user = Meteor.users.findOne({
        _id: this.userId
      });

      return Meteor.ldapgroups.find({
        _id: {
          '$in': _.isArray(user.roles) ? user.roles : _.keys(user.roles)
        }
      });
    } else {
      return this.ready();
    }
  });

  Meteor.startup(function() {
    Accounts.validateLoginAttempt(ldapLoginAttempt);
  });

  var ldapSetUserGroups = function(session, user, uid, dn) {

    if (!(_.isObject(Meteor.settings.ldap.group) && Meteor.settings.ldap.group.base)) {
      return;
    }

    var prefix = Meteor.settings.ldap.group.prefix || "ldap_";
    var defaultRole = Meteor.settings.ldap.group.defaultRole || "member";

    if (!(Roles && Meteor.roles)) {
      console.error("You need alanning:roles (or an API compatible package) to support ldap group");
      return;
    }

    var simpleRoles = _.isArray(user.roles);
    //var groupsForUser = Roles.getGroupsForUser(user._id);
    var existingGroups = _.reduce(Meteor.ldapgroups.find({}).fetch(), function(memo, group) {
      memo[group._id] = true
      return memo
    }, {});

    _.each(session.searchGroups(uid, dn), function(value, key) {

      Roles.addUsersToRoles(user._id, simpleRoles ? prefix+key : defaultRole, simpleRoles ? undefined : prefix+key);

      if (!existingGroups[prefix+key])
        Meteor.ldapgroups.insert({
          _id: prefix+key,
          name: value
        });
    });
  }

  var ldapFindUidFromServices = function(user) {

    if (_.isObject(user.services)) {

      // get supported service list
      var serviceNames = _.keys(user.services);
      if (_.isArray(Meteor.settings.ldap.supportedServices))
        serviceNames = _.intersection(serviceNames, Meteor.settings.ldap.supportedServices);

      if (!_.isArray(serviceNames) || serviceNames.length < 1)
        return undefined;

      var service = _.find(serviceNames, function(name) {
        return _.isString(user.services[name].id)
      });

      if (!_.isString(service)) {
        if (Meteor.settings.ldap.throwError)
          throw new Error("Unable to extract a uid from supported services");
        else
          return undefined;
      }

      return user.services[service].id;
    }

    return undefined;

  }

  var ldapLoginAttempt = function(attempt) {
    if (!attempt.allowed)
      return false;

    try {
      var session = new LDAPSession();
    } catch (e) {
      console.log("Unable to connect to LDAP");
      return Meteor.settings.ldap.allowNotFound ? true : false;
    }

    var uid = ldapFindUidFromServices(attempt.user);

    if (!uid) {
      console.log("No supported authentication service found");
      return attempt.allowed;
    }

    var ldapuser = session.searchUser(uid);

    if (!ldapuser && !Meteor.settings.ldap.allowNotFound) {
      console.error("User not found in LDAP directory or not authorized due to LDAP filter");
      return false;
    } else if (!ldapuser) {
      console.log("User not found in LDAP directory but allowed to logon by configuration");
      return true;
    }

    // update user profile
    var ops = [];
    ldapUpdateEmails(attempt.user, ldapuser, ops);

    if (Meteor.settings.ldap.forceUsername && uid !== attempt.user.username)
      ops.push({
        op: '$set',
        value: {
          username: uid
        }
      });

    // put any other user attributes into profile subdocument
    _.each(ldapuser, function(value, key) {
      if (attempt.user.profile && attempt.user.profile[key] === value)
        return;

      var data = {};
      data["profile." + key] = value;
      ops.push({
        op: '$set',
        value: data
      });
    });

    // update user in database if needed
    if (ops.length > 0) {
      var update = _.reduce(ops, function(memo, value) {
        if (!memo[value.op]) memo[value.op] = {};
        _.extend(memo[value.op], value.value);
        return memo;
      }, {});

      Meteor.users.update(attempt.user._id, update);
      console.log(JSON.stringify(update, 2, 2));
    }

    ldapSetUserGroups(session, attempt.user, uid, ldapuser.dn);

    session.disconnect();

    return true;
  }

  var ldapUpdateEmails = function(user, ldapuser, ops) {

    if (_.has(ldapuser, "mail") && _.isString(ldapuser.mail) && ldapuser.mail.length > 0) {
      var email = {
        address: ldapuser.mail,
        verified: true
      };

      if (!_.isArray(user.emails) || !_.find(user.emails, function(entry) {
          return ldapuser.mail === entry.address
        })) {
        ops.push({
          op: '$addToSet',
          value: {
            emails: email
          }
        });
      }

      delete ldapuser['mail'];
    }
  }

  function LDAPSession() {
    if (!(Meteor.settings && Meteor.settings.ldap && Meteor.settings.ldap.url && Meteor.settings.ldap.base)) {
      throw new Error("LDAP configuration not found");
    }

    this.opts = Meteor.settings.ldap;

    this.ldapclient = Npm.require('ldapjs').createClient(
      _.pick(this.opts, 'url', 'timeout', 'connectTimeout')
    );

    var bindDn = Meteor.settings.ldap.bindDn || "";
    var bindSecret = Meteor.settings.ldap.bindSecret || "";
    var _syncLdapBind = Meteor.wrapAsync(this.ldapclient.bind, this.ldapclient);
    _syncLdapBind(bindDn, bindSecret);
  }

  LDAPSession.prototype.searchUser = function(uid) {
    var Future = Npm.require("fibers/future");
    var future = new Future();

    var base = this.opts.base;

    // set filter
    var filter = this.opts.filter || "(uid=%uid)";
    filter = filter.replace(/%uid/g, uid);

    var opts = {
      scope: this.opts.scope || "one",
      filter: filter
    };

    var self = this;
    this.ldapclient.search(base, opts, function(err, res) {
      if (err) {
        console.error('accounts-ldap-profile: error: ' + err.message);
        future.return();
        return;
      }

      res.on('searchEntry', function(entry) {
        console.log('accounts-ldap-profile: get entry ' + entry.object.dn);
        if (!future.isResolved())
          future.return({
            name: entry.object[self.opts.nameAttribute || 'displayName'] ||
              entry.object.displayName ||
              entry.object.uid,
            mail: entry.object[self.opts.mailAttribute || 'mail'],
            dn: entry.object.dn
          });
      });

      res.on('error', function(err) {
        console.error('accounts-ldap-profile: res error: ' + err.message);
        if (!future.isResolved())
          future.return();
      });

      res.on('end', function(result) {
        if (!future.isResolved())
          future.return();
      });
    });

    return future.wait();
  }

  LDAPSession.prototype.searchGroups = function(uid, dn) {
    var Future = Npm.require("fibers/future");
    var future = new Future();

    if (!(_.isObject(this.opts.group) && this.opts.group.base)) {
      return;
    }

    var base = this.opts.group.base;
    var filter = this.opts.group.filter || "(&(objectClass=groupOfNames)(member=%dn))";
    var scope = this.opts.group.scope || "one"
    var nameAttribute = this.opts.group.nameAttribute || 'cn';
    var descAttribute = this.opts.group.descAttribute || 'description';

    var opts = {
      scope: scope,
      filter: filter.replace(/%uid/g, uid).replace(/%dn/g, dn)
    };

    var groups = {};

    this.ldapclient.search(base, opts, function(err, res) {
      if (err) {
        console.error('accounts-ldap-profile: group search error: ' + err.message);
        future.return();
        return;
      }

      res.on('searchEntry', function(entry) {
        //console.log('accounts-ldap-profile: get entry ' + entry.object.dn);
        groups[entry.object[nameAttribute]] = entry.object[descAttribute] || entry.object[nameAttribute];
      });

      res.on('error', function(err) {
        console.error('accounts-ldap-profile: res error: ' + err.message);
        if (!future.isResolved())
          future.return();
      });

      res.on('end', function(result) {
        if (!future.isResolved())
          future.return(groups);
      });
    });

    return future.wait();
  }

  LDAPSession.prototype.ping = function() {
    this.ldapclient.search('', '(objectclass=*)', function(err, res) {
      if (err)
        return console.log("LDAP : unable to ping (client error)");

      res.on('error', function(res) {
        console.log("LDAP : unable to ping (request error)");
      });

      res.on('end', function() {
        console.log("LDAP : ping ok");
      });
    });
  }

  LDAPSession.prototype.disconnect = function() {
    var _syncLdapUnbind = Meteor.wrapAsync(this.ldapclient.unbind, this.ldapclient);
    _syncLdapUnbind();
  }

})();
