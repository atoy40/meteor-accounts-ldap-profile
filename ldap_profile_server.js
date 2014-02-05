
// check settings
if (! (Meteor.settings && Meteor.settings.ldap && Meteor.settings.ldap.url && Meteor.settings.ldap.base)) {
  throw new Error("Missing LDAP configuration");
}

var ldap = Npm.require('ldapjs');
var client = ldap.createClient(
  _.pick(Meteor.settings.ldap, 'url', 'timeout', 'connectTimeout')
);

// bind before enabling OnCreateUser handler
var bindDn = Meteor.settings.ldap.bindDn || "";
var bindSecret = Meteor.settings.ldap.bindSecret || "";

client.bind(bindDn, bindSecret, function(err) {
  if (err) {
    console.error('accounts-ldap-profile: bind error'+err.message);
    throw new Error("Unable to bind to LDAP");
  }
  
  console.log('accounts-ldap-profile: bind ok');
  Accounts.onCreateUser(ldapOnCreateUser);
});

var ldapOnCreateUser = function(options, user) {
  // default behavior
  if (options.profile)
    user.profile = options.profile;

  var uid = ldapFindUidFromServices(user);

  // not a supported service
  if (uid === undefined)
    return user;

  // search in directory and extends user objet
  if (uid) {
    if (Meteor.settings.ldap.forceUsername)
      user.username = uid;

    var res = ldapGetAttributes(uid);

    if (!res && Meteor.settings.ldap.throwError)
      throw new Error("User not found in LDAP directory");
    else if (res)
      if (_.has(res, "mail") && _.isString(res.mail) && res.mail.length > 0) {
        user.emails = [ { address: res.mail, verified: true } ];
        delete res['mail'];
      }

      if (Meteor.settings.ldap.forceUsername)
        user.username = uid;

      user.profile = _.extend(_.omit(user.profile, 'mail') || {}, res);
  }

  return user;
}

var ldapGetAttributes = function(uid) {
  var Future = Npm.require("fibers/future");
  var future = new Future();

  var base = Meteor.settings.ldap.base;

  // set filter
  var filter = Meteor.settings.ldap.filter || "(uid=%uid)";
  filter = filter.replace(/%uid/g, uid);

  var opts = {
    scope: Meteor.settings.ldap.scope || "one",
    filter: filter
  };

  client.search(base, opts, function(err, res) {
    if (err) {
      console.error('accounts-ldap-profile: error: ' + err.message);
      future.return();
      return;
    }

    res.on('searchEntry', function(entry) {
      console.log('accounts-ldap-profile: get entry '+entry.object.dn);
      if (!future.isResolved())
        future.return({
          name: entry.object[Meteor.settings.ldap.nameAttribute || 'displayName'] ||
            entry.object.displayName ||
            entry.object.uid,
          mail: entry.object[Meteor.settings.ldap.mailAttribute || 'mail']
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
