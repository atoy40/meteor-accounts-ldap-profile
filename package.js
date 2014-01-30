Package.describe({
  summary: "LDAP support to create new accounts"
});

Package.on_use(function(api) {
  api.use('accounts-base', ['client', 'server']);
  // Export Accounts (etc) to packages using this one.
  api.imply('accounts-base', ['client', 'server']);
  api.use('underscore');

  Npm.depends({ldapjs: "0.7.0"});

  api.add_files('ldap_profile_server.js', 'server');
});