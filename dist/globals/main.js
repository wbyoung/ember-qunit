!function(e){if("object"==typeof exports)module.exports=e();else if("function"==typeof define&&define.amd)define(e);else{var f;"undefined"!=typeof window?f=window:"undefined"!=typeof global?f=global:"undefined"!=typeof self&&(f=self),f.emq=e()}}(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);throw new Error("Cannot find module '"+o+"'")}var f=n[o]={exports:{}};t[o][0].call(f.exports,function(e){var n=t[o][1][e];return s(n?n:e)},f,f.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(_dereq_,module,exports){
"use strict";
var Ember = window.Ember["default"] || window.Ember;

function isolatedContainer(fullNames, resolver) {
  var container = new Ember.Container();
  container.optionsForType('component', { singleton: false });
  container.optionsForType('view', { singleton: false });
  container.optionsForType('template', { instantiate: false });
  container.optionsForType('helper', { instantiate: false });
  container.register('component-lookup:main', Ember.ComponentLookup);
  for (var i = fullNames.length; i > 0; i--) {
    var fullName = fullNames[i - 1];
    container.register(fullName, resolver.resolve(fullName));
  }
  return container;
}

function builder(fullName, needs, resolver) {
  var container = isolatedContainer([fullName].concat(needs || []), resolver);
  var factory = function() {
    return container.lookupFactory(fullName);
  };
  return {
    container: container,
    factory: factory
  };
};

function builderForModel(name, needs, resolver) {
  var result = builder('model:' + name, needs, resolver);

  if (DS._setupContainer) {
    DS._setupContainer(result.container);
  } else {
    result.container.register('store:main', DS.Store);
  }

  var adapterFactory = result.container.lookupFactory('adapter:application');
  if (!adapterFactory) {
    result.container.register('adapter:application', DS.FixtureAdapter);
  }

  result.store = function() {
    return result.container.lookup('store:main');
  };

  result.subject = function(options) {
    return Ember.run(function() {
      return result.container.lookup('store:main').createRecord(name, options);
    });
  };

  return result;
}

function builderForComponent(name, needs, resolver) {
  var result = builder('component:' + name, needs, resolver);
  var layoutName = 'template:components/' + name;
  var layout = resolver.resolve(layoutName);

  if (layout) {
    result.container.register(layoutName, layout);
    result.container.injection('component:' + name, 'layout', layoutName);
  }

  result.dispatcher = Ember.EventDispatcher.create();
  result.dispatcher.setup({}, '#ember-testing');

  result.append = function(subject) {
    return function(selector) {
      var containerView = Ember.ContainerView.create({container: result.container});
      var view = Ember.run(function(){
        if (typeof subject === "function") { subject = subject(); }
        containerView.pushObject(subject);
        // TODO: destory this somewhere
        containerView.appendTo('#ember-testing');
        return subject;
      });

      return view.$();
    };
  };

  return result;
}

exports.builder = builder;
exports.builderForModel = builderForModel;
exports.builderForComponent = builderForComponent;
},{}],2:[function(_dereq_,module,exports){
"use strict";
var Ember = window.Ember["default"] || window.Ember;
var moduleFor = _dereq_("./module-for")["default"] || _dereq_("./module-for");
var moduleForComponent = _dereq_("./module-for-component")["default"] || _dereq_("./module-for-component");
var moduleForModel = _dereq_("./module-for-model")["default"] || _dereq_("./module-for-model");
var test = _dereq_("./test")["default"] || _dereq_("./test");
var testResolver = _dereq_("./test-resolver")["default"] || _dereq_("./test-resolver");

Ember.testing = true;

function setResolver(resolver) {
  testResolver.set(resolver);
}

function globalize() {
  window.moduleFor = moduleFor;
  window.moduleForComponent = moduleForComponent;
  window.moduleForModel = moduleForModel;
  window.test = test;
  window.setResolver = setResolver;
}

exports.globalize = globalize;
exports.moduleFor = moduleFor;
exports.moduleForComponent = moduleForComponent;
exports.moduleForModel = moduleForModel;
exports.test = test;
exports.setResolver = setResolver;
},{"./module-for":6,"./module-for-component":4,"./module-for-model":5,"./test":9,"./test-resolver":8}],3:[function(_dereq_,module,exports){
"use strict";
var Ember = window.Ember["default"] || window.Ember;
//import QUnit from 'qunit'; // Assumed global in runner
var testContext = _dereq_("./test-context")["default"] || _dereq_("./test-context");
var testResolver = _dereq_("./test-resolver")["default"] || _dereq_("./test-resolver");

exports["default"] = function qunitModule(builder, delegate) {
  return function moduleFor(fullName, description, callbacks) {
    var products;
    var context;
    
    var _callbacks = {
      setup: function(){
        callbacks = callbacks || { };
        callbacks.subject   = callbacks.subject || defaultSubject;

        callbacks.setup     = callbacks.setup    || function() { };
        callbacks.teardown  = callbacks.teardown || function() { };
        
        products = builder(fullName, callbacks.needs, testResolver.get());

        testContext.set({
          container:            products.container,
          factory:              products.factory,
          dispatcher:           null,
          __setup_properties__: callbacks
        });
        
        context = testContext.get();

        if (delegate) {
          delegate(products, context, {
            subjectIsDefault: (context.__setup_properties__.subject === defaultSubject)
          });
        }
        
        if (Ember.$('#ember-testing').length === 0) {
          Ember.$('<div id="ember-testing"/>').appendTo(document.body);
        }
        
        buildContextVariables(context);
        callbacks.setup.call(context, products.container);
      },

      teardown: function(){
        Ember.run(function(){
          products.container.destroy();
          
          if (context.dispatcher) {
            context.dispatcher.destroy();
          }
        });
        
        callbacks.teardown(products.container);
        Ember.$('#ember-testing').empty();
      }
    };

    QUnit.module(description || fullName, _callbacks);
  }
}

function defaultSubject(options, factory) {
  return factory.create(options);
}

// allow arbitrary named factories, like rspec let
function buildContextVariables(context) {
  var cache     = { };
  var callbacks = context.__setup_properties__;
  var container = context.container;
  var factory   = context.factory;
    
  Ember.keys(callbacks).filter(function(key){
    // ignore the default setup/teardown keys
    return key !== 'setup' && key !== 'teardown';
  }).forEach(function(key){
    context[key] = function(options) {
      if (cache[key]) { return cache[key]; }

      var result = callbacks[key](options, factory(), container);
      cache[key] = result;
      return result;
    };
  });
}
},{"./test-context":7,"./test-resolver":8}],4:[function(_dereq_,module,exports){
"use strict";
var Ember = window.Ember["default"] || window.Ember;
var qunitModule = _dereq_("./module-base")["default"] || _dereq_("./module-base");
var builderForComponent = _dereq_("./builder").builderForComponent;

exports["default"] = qunitModule(builderForComponent, function(products, context) {
  context.dispatcher = products.dispatcher;
  context.__setup_properties__.append = products.append(function() { return context.subject() });
  context.__setup_properties__.$ = context.__setup_properties__.append;
});
},{"./builder":1,"./module-base":3}],5:[function(_dereq_,module,exports){
"use strict";
var Ember = window.Ember["default"] || window.Ember;
var qunitModule = _dereq_("./module-base")["default"] || _dereq_("./module-base");
var builderForModel = _dereq_("./builder").builderForModel;

exports["default"] = qunitModule(builderForModel, function(products, context, options) {
  context.__setup_properties__.store = products.store;
  context.__setup_properties__.subject = options.subjectIsDefault ?
    products.subject : context.__setup_properties__.subject;
});
},{"./builder":1,"./module-base":3}],6:[function(_dereq_,module,exports){
"use strict";
var Ember = window.Ember["default"] || window.Ember;
var qunitModule = _dereq_("./module-base")["default"] || _dereq_("./module-base");
var builder = _dereq_("./builder").builder;

exports["default"] = qunitModule(builder, null);
},{"./builder":1,"./module-base":3}],7:[function(_dereq_,module,exports){
"use strict";
var __test_context__;

function set(context) {
  __test_context__ = context;
}

exports.set = set;function get() {
  return __test_context__;
}

exports.get = get;
},{}],8:[function(_dereq_,module,exports){
"use strict";
var __resolver__;

function set(resolver) {
  __resolver__ = resolver;
}

exports.set = set;function get() {
  if (__resolver__ == null) throw new Error('you must set a resolver with `testResolver.set(resolver)`');
  return __resolver__;
}

exports.get = get;
},{}],9:[function(_dereq_,module,exports){
"use strict";
var Ember = window.Ember["default"] || window.Ember;
//import QUnit from 'qunit'; // Assumed global in runner
var testContext = _dereq_("./test-context")["default"] || _dereq_("./test-context");

function resetViews() {
  Ember.View.views = {};
}

exports["default"] = function test(testName, callback) {

  function wrapper() {
    var context = testContext.get();
    
    resetViews();
    var result = callback.call(context);

    function failTestOnPromiseRejection(reason) {
      ok(false, reason);
    }

    Ember.run(function(){
      stop();
      Ember.RSVP.Promise.cast(result)['catch'](failTestOnPromiseRejection)['finally'](start);
    });
  }

  QUnit.test(testName, wrapper);
}
},{"./test-context":7}]},{},[2])
(2)
});