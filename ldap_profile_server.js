
// check settings
if (! (Meteor.settings && Meteor.settings.ldap && Meteor.settings.ldap.url && Meteor.settings.ldap.base)) {
  throw new Error({message: "Missing LDAP configuration"});
}

var ldap = Npm.require('ldapjs');
var client = ldap.createClient({ url: Meteor.settings.ldap.url });

// bind before enabling OnCreateUser handler
var bindDn = Meteor.settings.ldap.bindDn || "";
var bindSecret = Meteor.settings.ldap.bindSecret || "";

client.bind(bindDn, bindSecret, function(err) {
  if (err) {
    console.error('accounts-ldap-profile: bind error'+err.message);
    throw new Error({message: "Unable to bind to LDAP"});
  }
  
  console.log('accounts-ldap-profile: bind ok');
  Accounts.onCreateUser(ldapOnCreateUser);
});

var ldapOnCreateUser = function(options, user) {
  // default behavior
  if (options.profile)
    user.profile = options.profile;

  // find a uid value to use with ldap filter
  var uid;
  if (user.username) {
    uid = user.username;
  } else if (!_.isEmpty(user.services)) {
    _.find(user.services, function(service) {
      if (service.id) {
        uid = service.id;
        if (Meteor.settings.ldap.forceUsername)
          user.username = uid;
        return true;
      }
      return false;
    });
  } else if (!uid) {
    console.error("Unable to get uid for ldap request");
  }

  if (uid)
    user.profile = _.extend(user.profile || {}, ldapGetAttributes(uid));

  return user;
}

var ldapGetAttributes = function(uid) {
  var Future = Npm.require("fibers/future");
  var future = new Future();

  var base = Meteor.settings.ldap.base;
  var opts = {
    scope: Meteor.settings.ldap.scope || "one",
    filter: "(uid="+uid+")"
  };
  client.search(base, opts, function(err, res) {
    if (err) {
      console.error('accounts-ldap-profile: error: ' + err.message);
      future.return({});
      return;
    }

    res.on('searchEntry', function(entry) {
      console.log('accounts-ldap-profile: get entry '+entry.object.dn);
      if (!future.isResolved())
        future.return({
          name: entry.object[Meteor.settings.ldap.nameAttribute || 'displayName'] ||
            entry.object.displayName ||
            entry.object.uid
        });
    });

    res.on('error', function(err) {
      console.error('accounts-ldap-profile: res error: ' + err.message);
      if (!future.isResolved())
        future.return({});
    });

    res.on('end', function(result) {
      console.log('accounts-ldap-profile: request status ' + result.status);
      if (!future.isResolved())
        future.return({});
    });
  });

  return future.wait();
}
