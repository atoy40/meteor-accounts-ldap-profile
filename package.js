Package.describe({
  name: "atoy40:accounts-ldap-profile",
  summary: "LDAP support to manage user profiles and groups.",
  version: "0.1.1",
  git: "https://github.com/atoy40/meteor-accounts-ldap-profile.git"
});

Package.onUse(function(api) {
  api.versionsFrom("METEOR@1.0");
  api.use('accounts-base', ['client', 'server']);
  api.use('mongo', ['client', 'server']);
  // Export Accounts (etc) to packages using this one.
  api.imply('accounts-base', ['client', 'server']);
  api.use('underscore');


  api.add_files('ldap_profile_server.js', 'server');
});

Npm.depends({
  ldapjs: "0.7.0"
});
