meteor-accounts-ldap-profile
==================

LDAP support to manage user profiles and groups.

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
    "allowNotFound": false,
    "supportedServices": ["cas"],
    "group": {
      "base": "ou=groups,dc=univ-pau,dc=fr",
      "filter": "(&(objectClass=groupOfNames)(member=%dn))",
      "scope": "one",
      "nameAttribute": "cn",
      "descAttribute": "description",
    }
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
* **allowNotFound** will validate login attempt even if user is not found or LDAP connexion failed.
* **supportedServices** is a list of services to search for a id (use as uid for ldap request). Default is to search in all services.
* group management. It require alanning:roles or a API compatible package
 * **base** Base DN to search groups. It is mandatory if you want group management
 * **filter** LDAP filter. %uid and %dn can be used and will be replaced. Default is "(&(objectClass=groupOfNames)(member=%dn))"
 * **scope** LDAP search scope. default is "one" (can be "base", "one" and "tree")
 * **nameAttribute** is the attribute used for group id. Default to "cn".
 * **descAttribute** is the attribute used for group name. Default to "description".
 * **prefix** is a prefix add to group id. It is used to differentiate ldap groups and local groups. Default is "ldap_"
 * **defaultRole** is the role attribute to user mambers of a ldap group (see alanning:roles for details). Default is "member"
