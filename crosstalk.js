/*
 * crosstalk.js: Crosstalk context emulator constructor helper.
 *
 * (C) 2012-2013 Crosstalk Systems Inc.
 */

var clone = require( './clone' ),
    createVmErrorMessage = require( './createVmErrorMessage' ),
    createWorkerName = require( './createWorkerName' ),
    eventIsAuthorized = require( './eventIsAuthorized' ),
    stdjson = require( 'stdjson' )();

//
// ### function crosstalk ( wrapper, options )
// #### @wrapper {object} the wrapper object using this sandbox
// #### @options {object} options to use when creating the sandbox
//   options = {
//     config : {}, // worker configuration
//     environmentId : 0, // the id of the environment the worker runs in
//     silent : false, // silence logging of messages
//     workerId : 0, // the id of the worker
//     workerPath : "", // path of the worker using this context
//   }
// Creates a crosstalk context emulation to execute workers in.
//
var crosstalk = function crosstalk ( wrapper, options ) {

  var context = {};

  // create the emit method
  context.emit = function emit ( workerReference, message, data, scope, 
     callback ) {

    // workerReference is optional
    if ( typeof( workerReference ) != 'object' ) {
      callback = scope;
      scope = data;
      data = message;
      message = workerReference;
      workerReference = null;
    }

    // scope is optional and not a function
    if ( typeof( scope ) === 'function' ) {

      callback = scope;
      scope = null;

    } // if ( typeof( scope ) === 'function' )

    if ( typeof( data ) != 'undefined' && typeof( data ) != 'object' ) {
      throw new Error( "'data', if provided, must be an object" );
    }

    if ( callback ) {

      // wrap callback with telemetry for testing purposes
      var originalCallback = callback;
      callback = function ( error, response ) {

        if ( error ) {

          if ( typeof( error ) == 'string' ) {
            error = { message : error };
          }

          error = error || {};

          wrapper.history.out( '@callback.' + message + '.error', error );
          if ( ! options.silent ) {
            logCallback( true, message, error, scope, options );
          }
          wrapper.emit( '@callback.' + message + '.error', error );
          return originalCallback( error, response );

        } // if error

        if ( typeof( response ) != 'object' &&
           typeof( response ) != 'undefined' ) {
          response = { response : response };
        }

        response = response || {};

        wrapper.history.out( '@callback.' + message + '.response', response );
        if ( ! options.silent ) {
          logCallback( false, message, response, scope, options );
        }
        wrapper.emit( '@callback.' + message + '.response', response );
        return originalCallback( error, response );

      }; // callback

    } // if ( callback )

    wrapper.history.out( message, clone( data ), scope, callback, null, 
       workerReference );
    options.silent ? null : logEmit( message, data, scope, options );

    // if we are proxying to crosstalk swarm, send the message out
    if ( wrapper.proxy && message ) {
      
      if ( ! Array.isArray( wrapper.proxy ) ) {

        if ( message.match( wrapper.proxy  ) ) {

          // can't proxy object capability security
          if ( workerReference ) {
            throw new Error( "Cannot proxy object capability security " +
               "(can't send to Crosstalk Swarm a message addressed to " +
               "local emulation of worker reference)" );
          }

          return wrapper.proxySend( wrapper.crosstalkToken, message, data, 
             scope, callback );

        } // if ( message.match( wrapper.proxy ) )

      } else {

        var matches = false;

        wrapper.proxy.forEach( function ( regex ) {
          if ( message.match( regex ) ) matches = true;
        });

        if ( matches ) {

          // can't proxy object capability security
          if ( workerReference ) {
            throw new Error( "Cannot proxy object capability security " +
               "(can't send to Crosstalk Swarm a message addressed to " +
               "local emulation of worker reference)" );
          }

          return wrapper.proxySend( wrapper.crosstalkToken, message, data, 
             scope, callback );

        } // if ( matches )

      } // else

    } // if ( wrapper.proxy && message )
    
    return wrapper.emit( message, data, scope, callback, workerReference );

  }; // context.emit

  // create the on method
  context.on = function on ( workerReference, message, scope, handler ) {

    // workerReference is optional
    if ( typeof( workerReference ) != 'object' ) {

      handler = scope;
      scope = message;
      message = workerReference;
      workerReference = null;

    }

    // scope is optional and not a function
    if ( typeof( scope ) === 'function' ) {
      handler = scope;
      scope = null;
    }

    wrapper.on( message, function ( params, emittedScope, callback, 
       workerReference ) {

      wrapper.history.in( message, clone( params ), scope, emittedScope, null, 
         workerReference );

      if ( ! eventIsAuthorized( scope, emittedScope ) ) {
        return logDeliveryFailure( message, params, scope, emittedScope,
           options );
      }

      options.silent ? null : logReceive( message, params, options );

      // provide meaningful message after failure inside worker vm
      try {
        handler( params, callback );
      } catch ( error ) {
        stdjson.error( createVmErrorMessage( error, options.workerPath ), 
           error );
      }

    }); // wrapper.on

  }; // context.on

  context.publish = function publish ( message, data, scope, callback ) {

    wrapper.history.out( message, clone( data ), scope, callback, 'pubsub' );
    options.silent ? null : logPublish( message, data, scope, options );

    // there is no proxying to publish because publishing provides no callbacks

    return wrapper.publish( message, data, scope, true );

  }; // context.publish

  context.subscribe = function subscribe ( message, handler ) {

    wrapper.on( message, function ( params, emittedScope, callback ) {

      wrapper.history.in( message, clone( params ), null, emittedScope, 
         'pubsub' );

      options.silent ? null : logSubscription( message, params, options );

      // provide meaningful message after failure inside worker vm
      try {
        handler( params, callback );
      } catch ( error ) {
        stdjson.error( createVmErrorMessage( error, options.workerPath ), 
           error );
      }

    }); // wrapper.on

  }; // context.subscribe

  return context;

}; // crosstalk

module.exports = crosstalk;

//
// ### function logCallback ( isError, message, data, scope, options )
// #### @isError {boolean} determines if callback is error callback or response
// #### @message {string} message emmitted in the callback
// #### @data {object} data received with the callback
// #### @scope {string|object} callback emitted scope
// #### @options {object} options passed in on worker creation
// Logs to the console when a worker calls a callback.
//
var logCallback = function logCallback ( isError, message, data, scope, 
   options ) {

  var call = isError ? stdjson.error : stdjson.info;

  call( "CALLBACK", { 
    workerName : createWorkerName( options ),
    kind : isError ? "ERROR" : "RESPONSE",
    message : message,
    data : data,
    scope : scope,
    hasCallback : false
  });

}; // logCallback

//
// ### function logDeliverFailure ( message, data, options )
// #### @message {string} message to be logged
// #### @data {object} data to be logged
// #### @scope {string|object} scope accepted by listener
// #### @emittedScope {string|object} scope emmitted in the event
// #### @options {object} options passed in on worker creation
// Logs failure of message delivery due to scope mismatch
//
var logDeliveryFailure = function logDeliveryFailure ( message, data, scope,
   emittedScope, options ) {

  if ( ! scope ) {
    scope = "not provided (self)";
  }

  if ( ! emittedScope ) {
    emittedScope = "not provided (self)";
  }

  stdjson.log( "NOT AUTHORIZED", {
    workerName : createWorkerName( options ),
    acceptsScope : scope,
    emittedScope : emittedScope,
    message : message,
    data : data
  });

}; // logDeliverFailure

//
// ### function logEmit ( message, data, options )
// #### @message {string} message emitted by the worker
// #### @data {object} data received with the event
// #### @scope {string|object} callback scope
// #### @options {object} options passed in on worker creation
// Logs to the console when a worker sends a message.
//
var logEmit = function logEmit ( message, data, scope, options ) {

  stdjson.log( "EMIT", {
    workerName : createWorkerName( options ),
    message : message,
    data : data,
    scope : scope
  });
  
}; // logEmit

//
// ### function logPublish ( message, data, options )
// #### @message {string} message emitted by the worker
// #### @data {object} data received with the event
// #### @scope {string|object} callback scope
// #### @options {object} options passed in on worker creation
// Logs to the console when a worker publishes a message.
//
var logPublish = function logPublish ( message, data, scope, options ) {

  stdjson.log( "PUBLISH", {
    workerName : createWorkerName( options ),
    message : message,
    data : data,
    scope : scope
  });

}; // logPublish

//
// ### function logReceive ( message, data, options )
// #### @message {string} message received by the worker
// #### @data {object} data received with the event
// #### @options {object} options passed in on worker creation
// Logs to the console when a worker receives a message.
//
var logReceive = function logReceive ( message, data, options ) {

  stdjson.log( "ON", {
    workerName : createWorkerName( options ),
    message : message,
    data : data
  });

}; // logReceive

//
// ### function logSubscription ( message, data, options )
// #### @message {string} message received by the worker
// #### @data {object} data received with the event
// #### @options {object} options passed in on worker creation
// Logs to the console when a worker receives a message.
//
var logSubscription = function logSubscription ( message, data, options ) {

  stdjson.log( "SUBSCRIPTION", {
    workerName : createWorkerName( options ),
    message : message,
    data : data
  });

}; // logSubscription