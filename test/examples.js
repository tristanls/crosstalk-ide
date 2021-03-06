var examples = [
  'examples/example-object-capability-security/test/capability',
  'examples/example-reliable-messaging/test/reliable',
  'examples/example-scopeObject/test/scopeObject',
  'examples/example-subscribe/test/subscribe',
  'examples/testing-callCallback/test/callCallback',
  'examples/testing-callErrorCallback/test/callErrorCallback',
  'examples/testing-dontMockHttp/test/dontMockHttp',
  'examples/testing-dontMockHttps/test/dontMockHttps',
  'examples/testing-httpRequestFor/test/httpRequestFor',
  'examples/testing-httpResponseFor/test/httpResponseFor',
  //'examples/testing-proxy/test/proxy', // requires crosstalk token
  'examples/testing-sendHttpResponseTo/test/sendHttpResponseTo',
  'examples/testing-shouldAcceptImplicitSelfScope/test/shouldAccept',
  'examples/testing-shouldBeSilent/test/shouldBeSilent',
  'examples/testing-shouldBeSilentFromNowOn/test/shouldBeSilentFromNowOn',
  'examples/testing-shouldCallCallback/test/shouldCallCallback',
  'examples/testing-shouldCallCallbackFromWorker/test/shouldCallCallback',
  'examples/testing-shouldCallErrorCallback/test/shouldCallErrorCallback',
  'examples/testing-shouldEmit/test/shouldEmit',
  'examples/testing-shouldEmitNew/test/shouldEmitNew',
  'examples/testing-shouldNotEmit/test/shouldNotEmit',
  'examples/testing-shouldPublish/test/shouldPublish',
  'examples/testing-version/test/version'
];

examples.forEach( function ( example ) {
  require( '../' + example );
});