import { Observable, Computed, action } from "onek";

const proxyCache = new WeakMap();
const unwrapMap = new WeakMap();

function isPrimitive(value: any): boolean {
  return value === null || typeof value !== "object";
}

function unwrap(obj: any): any {
  return isPrimitive(obj) ? obj : unwrapMap.get(obj) || obj;
}

export function makeModel(root: any, checkFn?: boolean | ((a: any, b: any) => boolean)) {
  function wrap(obj: any) {
    if (isPrimitive(obj)) {
      return obj;
    }

    obj = unwrap(obj);

    let { proxy, observable: parentObservble } = proxyCache.get(obj) || {};

    if (proxy) return proxy;

    const observableMap = new Map();
    const boundCache = new Map();
    const settersMap = new Map();

    function setValue(target: any, prop: any, value: any) {
      if (typeof value === "function") {
        value = value.bind(proxy);

        boundCache.set(prop, value);

        return value;
      }

      // get existing observable for the property
      let observable = observableMap.get(prop);

      value = unwrap(value);

      const wrapped = wrap(value);

      // get the newely created observable for the value after wrapping
      const valueObservable =
        !isPrimitive(value) && proxyCache.get(value).observable;

      // if there is no existing observable for the property
      // or it doesn't match the value observable, we need to create a new observable
      if (!observable || valueObservable !== observable) {
        // as we're creating a new observable, we need to notify the old one
        // so its subscribers will know that the value has changed
        observable && observable.notify();

        observable = valueObservable || new Observable(wrapped, checkFn);

        observableMap.set(prop, observable);
      }

      // we've added a new property, so we need to notify the parent
      if (!Reflect.has(target, prop)) {
        parentObservble.notify();
      }

      // if the value is an array and we're setting the length
      // we need to remove the extra items from the observable map
      if (Array.isArray(value) && prop === "length") {
        let length = Reflect.get(target, prop);

        while (length > value) {
          length -= 1;
          observableMap.delete("" + length);
        }

        parentObservble.notify();
      }

      observable.set(wrapped);

      return wrapped;
    }

    proxy = new Proxy(obj, {
      get(target, prop, receiver) {
        let observable = observableMap.get(prop);

        if (observable) {
          return observable.get();
        }

        let value = Reflect.get(target, prop, receiver);

        if (
          prop === "__proto__" ||
          prop === "constructor" ||
          prop === "prototype" ||
          typeof prop === "symbol"
        ) {
          return value;
        }

        if (typeof value === "function") {
          let bound = boundCache.get(prop);

          if (!bound) {
            bound = action(value).bind(proxy);
            
            boundCache.set(prop, bound);
          }

          return bound;
        }

        if (!observable) {
          value = unwrap(value);

          const wrapped = wrap(value);

          observable = isPrimitive(wrapped)
            ? new Observable(wrapped, checkFn)
            : proxyCache.get(value).observable;

          observableMap.set(prop, observable);
        }

        return observable.get();
      },
      set(target, prop, value) {
        if (settersMap.has(prop)) {
          const setter = settersMap.get(prop);

          setter(value);

          return true;
        }

        const wrapped = setValue(target, prop, value);

        return Reflect.set(target, prop, wrapped);
      },
      deleteProperty(target, prop) {
        const observable = observableMap.get(prop);

        if (observable) {
          observable.notify();
        }

        observableMap.delete(prop);
        boundCache.delete(prop);
        settersMap.delete(prop);

        return Reflect.deleteProperty(target, prop);
      },
      defineProperty(target, prop, descriptor) {
        const value = descriptor.value;

        if (value !== undefined) {
          const wrapped = setValue(target, prop, value);
          descriptor.value = wrapped;
        }

        if (descriptor.get) {
          const computed = new Computed(descriptor.get.bind(proxy), checkFn);

          observableMap.set(prop, computed);
        }

        if (descriptor.set) {
          const setter = action(descriptor.set).bind(proxy);

          settersMap.set(prop, setter);
        }

        return Reflect.defineProperty(target, prop, descriptor);
      }
    });

    const proto = Object.getPrototypeOf(obj);

    if (proto === Object.prototype || proto === null) {
      const descriptors = Object.getOwnPropertyDescriptors(obj);

      Object.keys(descriptors).forEach((prop) => {
        const descriptor = descriptors[prop];

        if (descriptor.get) {
          const computed = new Computed(descriptor.get.bind(proxy), checkFn);
  
          observableMap.set(prop, computed);
        }
  
        if (descriptor.set) {
          const setter = action(descriptor.set).bind(proxy);
  
          settersMap.set(prop, setter);
        }
      });
    }

    parentObservble = new Observable(proxy, checkFn);

    proxyCache.set(obj, { proxy, observable: parentObservble });
    unwrapMap.set(proxy, obj);

    return proxy;
  }

  return wrap(root);
}