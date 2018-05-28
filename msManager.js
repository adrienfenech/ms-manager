"use strict"
/**
 * DatabseManager module.
 * Created at 22/12/2017
 * By Adrien
 *
 * @module msManager
 */
var logger = {
    info: function() {
        console.log('[info] ' + Array.from(arguments).map((e) => { return e.toString() + ', ' }));
    },
    log: function() {
        console.log('[log] ' + Array.from(arguments).map((e) => { return e.toString() + ', ' }));
    },
    debug: function() {
        console.log('[debug] ' + Array.from(arguments).map((e) => { return e.toString() + ', ' }));
    },
    error: function() {
        console.error(arguments[0]);
    }
};
const hydra = require('hydra');
const handlers = {};
const bus = {};

const stats = {
    nb_message_received: 0,
    nb_message_send: 0,
    nb_message_not_send: 0,
    nb_message_error_no_rmid: 0,
    nb_message_error_no_subscribers: 0,
};

module.exports = {

    /**
     * Initialize the hydra micro-service with a configuration Object.
     * When the initialisation is done, the callback is trigger.
     * @name init
     * @summary Initialize the hydra micro-service with a configuration Object.
     * @param {Object} configuration - The configuration of the micro-service which can contains a logger implementation { hydra: {...} [, _LOGGER: {...}]}
     * @param {Function} done - The callback that handles the initialization
     */
    init: function(configuration, done) {
        if (!configuration)
            return done(new Error('No configuration provided to establish connection. Aborting...'));

        if (configuration._LOGGER)
            logger = configuration._LOGGER;

        const hydra = require('hydra');
        logger.info('Initialize the hydra module with the configuration object.');
        hydra.init(configuration).then(() => {
            logger.info('Register the micro-service.');
            hydra.registerService().then((serviceInfo) => {
                logger.info(`Running ${serviceInfo.serviceName} at ${serviceInfo.serviceIP}:${serviceInfo.servicePort}`);

                registerReceiver();
                if (done)
                    return process.nextTick(done, null, serviceInfo);

            }).catch((err) => {
                if (done)
                    return process.nextTick(done, err);
                else
                    console.error(err);
                hydra.shutdown();
                process.exit(-1);
            });
        });
    },

    /**
     * Send a message to a specific service
     * @name send
     * @summary Send a message to a specific service
     * @param {String} to - service's name targeted
     * @returns {{to: *, body: null, type: string, for: for, with: with, done: done}} - Promise
     */
    send: function(to) {
        const dementor = {
            to: to,
            body: null,
            type: module.exports.typ_PING,
            for: function(type) {
                if (type)
                    dementor.type = type;
                logger.debug('[SEND] Preparing new message of type ' + type);
                return dementor;
            },
            with: function(body) {
                if (body)
                    dementor.body = body;
                logger.debug('[SEND] Preparing new message with body ' + body.toString());
                return dementor;
            },
            done: function(cb) {
                logger.debug('[SEND] Create message (to, from, type, body)');
                let message = hydra.createUMFMessage({
                    to: to,
                    from: hydra.getInstanceID() + '@' + hydra.getServiceName(),
                    type: dementor.type,
                    body: dementor.body
                });

                if (cb) {
                    logger.debug('[SEND] Register handler at ' + message.mid);
                    handlers[message.mid] = cb;
                } else {
                    logger.debug('[SEND] No handler to register');
                }
                logger.debug('[SEND] Send the message');
                hydra.sendMessage(message).then(() => {
                    logger.debug('[SEND] Message sent !');
                    stats.nb_message_send++;
                }).catch((err) => {
                    stats.nb_message_not_send++;
                    logger.debug('[SEND] Message not sent...');
                    if (cb) {
                        cb(err);
                    } else {
                        console.error(err);
                    }
                });
            }
        };

        return dementor;
    },

    /**
     * Subscribe to a specific message type to handle it
     * @name subscribe
     * @summary Subscribe to a specific message type to handle it
     * @param {String} type - The message's type to subscribe on
     * @param {Function} cb - The callback triggered when a message is received on the specific type
     */
    subscribe: function(type, cb) {
        if (!bus[type]) {
            logger.debug('[CONFIG] New subscriber for ' + type + ' but no bus associated. Creating...');
            bus[type] = [];
        }
        logger.debug('[CONFIG] New subscriber for ' + type + '.');
        bus[type].push(cb);
    },

    /**
     * TODO
     * @name getStats
     * @summary Get statistics about this service
     * @returns {null}
     */
    getStats: function() {
        return null; // TODO
    },

    typ_REPLY: 'reply',
    typ_REPLY_ERR: 'reply_err',
    typ_PING: 'ping',
    typ_PONG: 'pong',
    typ_NO_SUBSCRIBERS: 'no_subscribers',
};

/**
 * Rergister service and initialize bus
 */
function registerReceiver() {
    hydra.on('message', function(msg) {
        logger.debug('[IN] Message received');
        logger.debug(msg);
        stats.nb_message_received++;
        switch (msg.typ) {
            /**
             * RECEIVE REPLY CASE (Good)
             */
            case module.exports.typ_REPLY:
                logger.debug('[--] ' + module.exports.typ_REPLY);
                if (msg.rmid) {
                    logger.debug('[--] Handler exist, deliver message...');
                    handlers[msg.rmid](null, msg.bdy);
                    logger.debug('[--] Delete handler.');
                    return delete handlers[msg.rmid];
                } else {
                    logger.debug('[--] Handler doesn\'t exist. Aborting with error...');
                    return console.error(new Error('No \'rmid\' field for the message ' + JSON.stringify(msg)));
                }
                break;
            /**
             * RECEIVE REPLY CASE (Error)
             */
            case module.exports.typ_REPLY_ERR:
                logger.debug('[--] ' + module.exports.typ_REPLY_ERR);
                if (msg.rmid) {
                    logger.debug('[--] Handler exist, deliver error...');
                    handlers[msg.rmid](msg.bdy);
                    logger.debug('[--] Delete handler.');
                    return delete handlers[msg.rmid];
                } else {
                    logger.debug('[--] Handler doesn\'t exist. Aborting with error...');
                    return console.error(new Error('No \'rmid\' field for the message ' + JSON.stringify(msg)));
                }
                break;

            /**
             * RECEIVE REPLY CASE
             */
            case module.exports.typ_NO_SUBSCRIBERS:
                logger.debug('[--] ' + module.exports.typ_NO_SUBSCRIBERS);
                if (msg.rmid) {
                    logger.debug('[--] Handler exist, deliver no subscriber...');
                    handlers[msg.rmid](new Error('No subscribers registered for that type'));
                    logger.debug('[--] Delete handler.');
                    return delete handlers[msg.rmid];
                } else {
                    logger.debug('[--] Handler doesn\'t exist. Aborting with error...');
                    return console.error(new Error('No \'rmid\' field for the message ' + JSON.stringify(msg)));
                } break;

            /**
             * RECEIVE ORDER CASE
             */
            case module.exports.typ_PING:
                logger.debug('[--] ' + module.exports.typ_PING);
                hydra.sendReplyMessage(msg, hydra.createUMFMessage({
                    type: module.exports.typ_PONG,
                    body: {}
                }));
                break;
        }


        /**
         * RECEIVE ORDER CASE
         */
        logger.debug('[--] Receive order');
        if (bus[msg.typ]) {
            logger.debug('[--] Bus for ' + msg.typ + ' exists.');
            /**
             * If no subscribers to the type, send typ_REPLY_ERR
             */
            if (bus[msg.typ].length === 0) {
                logger.debug('[--] No subscribers for ' + msg.typ);
                return hydra.sendReplyMessage(msg, hydra.createUMFMessage({
                    type: module.exports.typ_REPLY_ERR,
                    body: new Error('No subscribers for the type ' + msg.typ)
                }));
            }

            logger.debug('[--] Add reply and replyErr to the msg');
            Object.assign(msg, {

                /**
                 * Add method 'reply' in order to send a message back with an optional body.
                 */
                reply: (body) => {
                    logger.debug('[OUT] Send reply for ' + msg.typ);
                    hydra.sendReplyMessage(msg, hydra.createUMFMessage({
                        type: module.exports.typ_REPLY,
                        body: body || {}
                    })).then(() => {
                        logger.debug('[SEND] Message Reply sent !');
                    }).catch((err) => {
                        logger.debug('[SEND] Message Reply not sent...');
                        console.error(err);
                    });
                },

                /**
                 * Add method 'replyErr' in order to send a message with an optional error.
                 */
                replyErr: (err) => {
                    logger.debug('[OUT] Send replyErr for ' + msg.typ);
                    hydra.sendReplyMessage(msg, hydra.createUMFMessage({
                        type: module.exports.typ_REPLY_ERR,
                        body: err || new Error('An error occurred.')
                    })).then(() => {
                        logger.debug('[SEND] Message Reply Err sent !');
                    }).catch((err) => {
                        logger.debug('[SEND] Message Reply Err not sent...');
                        console.error(err);
                    });
                }
            });

            /**
             * Call every subscribers interested by this message type
             */
            logger.debug('[--] Advertise every subscribers');
            bus[msg.typ].forEach((elt, index) => {
                logger.debug('[--] Advertise subscriber at index ' + index);
                elt(msg.bdy, msg);
            });
        } else {
            /**
             * Message type unrecognized, send a typ_REPLY_ERR
             */
            logger.debug('[--] Bus for ' + msg.typ + ' not recognized. Send directly an error reply.');
            hydra.sendReplyMessage(msg, hydra.createUMFMessage({
                type: module.exports.typ_REPLY_ERR,
                body: new Error('Unrocognized type ' + msg.typ)
            }));
        }
    });
}