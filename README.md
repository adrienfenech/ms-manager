# ms-manager
## How to use *ms-manager*

*ms-manager* is based on [Hydra](https://github.com/flywheelsports/hydra) project, leaded by [Cjus](https://github.com/cjus).
This version add easy messaging and answer.

## Configuration

In order to work properly, you need ***redis*** server to run (A docker container works too ! ;))
A configuration file is needed, generally **.config/config.json** and should contain the following:

```json
{  
	"environment": "<environment of this service (ex: development)>",  
	"hydra": {  
		"serviceName": "<name of this service [required]>",  
		"serviceIP": "<ip of the service>",  
		"servicePort": 9000,  
		"serviceType": "<type of this service>",  
		"serviceDescription": "<description of this service>",  
		"redis": {  
		    "url": "redis://127.0.0.1:6379/0"  
		}  
	}  
}
```

Don't forget to provide the url of redis. If you use docker, you should use `process.env.REDIS_PORT + '/0'`

## API

### initialization

The following code let's you register your micro-service:

```js
	const MM = require('ms-manager');  
	let config = require(`./config/config.json`) || {};  
  
	config['hydra']['redis']['url'] = process.env.REDIS_PORT + '/0';  
  
	MM.init(config, (err, serviceInfo) => {  
	    if (err) {  
	        console.error(err);  
		} else {  
	        /**  
			 * Our micro-service is now up. 
			 * */
			 console.log('#Micro-service UP#');  
		}  
	});
```

### Send message

You can send a message to a specific service with a specific purpose with the following code:
```js
const MM = require('ms-manager');  
MM.send('targeted-service')
	.for('my-message')
	.with(obj);
```
In this code:

* `.send('targeted-service')` specifies which micro-service is required.
* `.for('my-message')` specifies which message is send.
* `.with(obj)` add an object to the message.

The message can be string as well as a json object. 

In order to retrieve the answer, you can add the `.done(callback)` to the chain, like the following:

```js
const MM = require('ms-manager');  
MM.send('targeted-service')
	.for('my-message')
	.with(msg)
	.done((err, obj) => {
		if (err) {
			console.error(err);
		} else {
			console.log(obj);
		}
	});
```

### Subscribe and reply to a message

You can subscribe to specific messages with the following code:

```js
const MM = require('ms-manager');  
MM.subscribe('my-message', (bdy, msg) => {  
	/**
	 * bdy contains the string / json message sent
	 **/
	 process(bdy);
	 
	/**
	 * You can send back an error with msg.replyErr();
	 **/
	 msg.replyErr(err);
	 
	/**
	 * You can send back a string or an object with msg.reply();
	 **/
	 msg.reply(obj);  
});
```


## Example

You can see a demo project at [https://github.com/adrienfenech/mymicroservice](https://github.com/adrienfenech/mymicroservice/tree/dev)
