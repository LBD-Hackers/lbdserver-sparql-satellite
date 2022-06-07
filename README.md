# database-satellite-template
Generic Express.js template for an LBDserver satellite to sync data on a Pod with external databases. To be notified by a synchronisation satellite (https://github.com/LBD-Hackers/solid-synchronisation-satellite) 

One synchronisation route is exposed, accessible with 3 methods: 

* POST: add a dataset to the satellite database
* DELETE: delete a dataset from the satellite database
* UPDATE update a dataset on the satellite database

The url of this resource on the Pod (original resource) is communicated via a JSON body (`{"url": "http://pod.example.org/myResource"}`). 