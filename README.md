meteor-accounts-ldap-profile
==================

LDAP support to set profile of new users

## Usage

put LDAP settings in Meteor.settings (for exemple using METEOR_SETTINGS env or --settings) like so:

```
  "ldap": {
    "url": "ldap://my.ldapserver.com",
    "base": "ou=people,dc=mydomain",
    "bindDn": "cn=admin,dc=mydomain",
    "bindSecret": "thesecret",
    "scope": "one",
    "nameAttribute": "displayName",
    "forceUsername": true
  },
```

* url and base are mandatory
* to bind anonymous, set bindDn and bindSecret to empty string
* default scope is "one" (can be "base", "one" and "tree")
* default nameAttribute is displayName, fallback to uid if not found
* forceUsername is default to true. It just set the uid as user.username

the uid used to search the ldap entry is the first user.services.[servicename].id found.
