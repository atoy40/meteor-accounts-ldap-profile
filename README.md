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
    "filter": "(&(uid=%uid)(objectClass=inetOrgPerson))",
    "scope": "one",
    "nameAttribute": "displayName",
    "forceUsername": true,
    "throwError": true,
  },
```

* url and base are mandatory
* to bind anonymous, set bindDn and bindSecret to empty string
* filter allow you to specify the search filter. all instances of %uid will be replaced. Default is "(uid=%uid)"
* default scope is "one" (can be "base", "one" and "tree")
* default nameAttribute is displayName, fallback to uid if not found
* forceUsername to true will copy the uid as user.username
* throwError will abort user creation if it's not found in directory

## Notes

LDAP search use a simple filter based on uid attribute. the uid used to search the entry is the username property or first user.services.[servicename].id found.

The package use the Accounts.onCreateUser function to reference itself. This function can only be called once, so, be sure to not have another package using it.
