meteor-accounts-ldap-profile
==================

LDAP support to set profile of new users

## Usage

put LDAP settings in Meteor.settings (for exemple using METEOR_SETTINGS env or --settings) like so:

```
  "ldap": {
    "url": "ldap://my.ldapserver.com",
    "base": "ou=people,dc=mydomain",
    "timeout": 10000,
    "bindDn": "cn=admin,dc=mydomain",
    "bindSecret": "thesecret",
    "filter": "(&(uid=%uid)(objectClass=inetOrgPerson))",
    "scope": "one",
    "nameAttribute": "displayName",
    "mailAttribute": "mail",
    "forceUsername": true,
    "throwError": true,
    "supportedServices": ["cas"]
  },
```

* **url** and **base** are mandatory
* ldapjs connexion parameters **timeout** and **connectTimeout** can be used
* to bind anonymous, set **bindDn** and **bindSecret** to empty string
* **filter** allow you to specify the search filter. all instances of %uid will be replaced. Default is "(uid=%uid)"
* default **scope** is "one" (can be "base", "one" and "tree")
* default **nameAttribute** is displayName, fallback to uid if not found
* default **mailAttribute** is mail. It's used to populate user.emails array.
* **forceUsername** to true will copy the uid as user.username
* **throwError** will abort user creation if it's not found in directory
* **supportedServices** is a list of services to search for a id (use as uid for ldap request). Default is to search in all services.

## Notes

The package use the Accounts.onCreateUser function to reference itself. This function can only be called once, so, be sure to not have another package using it.
