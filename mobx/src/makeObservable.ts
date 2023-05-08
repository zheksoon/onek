import { Computed, IGettable, Observable, tx } from "onek";

const enum GetterContext {
    NONE,
    INSTANCE,
    NOTIFY,
}

let getterContext = GetterContext.NONE;
let getterResult: IGettable<any> | undefined = undefined;

export function instance<T>(fn: () => T): IGettable<T> | undefined {
    getterContext = GetterContext.INSTANCE;
    try {
        fn();
        return getterResult;
    } finally {
        getterContext = GetterContext.NONE;
        getterResult = undefined;
    }
}

export function notify(thunk: () => any): void {
    getterContext = GetterContext.NOTIFY;
    tx(() => {
        try {
            thunk();
        } finally {
            getterContext = GetterContext.NONE;
        }
    });
}

export function makeObservable<T extends {}>(obj: T): T {
    const descriptors: (PropertyDescriptor & { key: string })[] = [];

    Object.keys(obj).forEach((key) => {
        const currentDescriptor = Object.getOwnPropertyDescriptor(obj, key);

        if (
            currentDescriptor &&
            currentDescriptor.configurable &&
            currentDescriptor.value !== undefined
        ) {
            const prop = currentDescriptor.value;

            if (prop instanceof Observable) {
                descriptors.push({
                    key: key,
                    enumerable: true,
                    configurable: true,
                    get() {
                        if (getterContext === GetterContext.NONE) {
                            return prop.get();
                        } else if (getterContext === GetterContext.INSTANCE) {
                            getterResult = prop;
                        } else if (getterContext === GetterContext.NOTIFY) {
                            prop.notify();
                        }
                    },
                    set(value: any) {
                        prop.set(value);
                    },
                });
            } else if (prop instanceof Computed) {
                descriptors.push({
                    key: key,
                    enumerable: true,
                    configurable: true,
                    get() {
                        if (getterContext === GetterContext.NONE) {
                            return prop.get();
                        } else if (getterContext === GetterContext.INSTANCE) {
                            getterResult = prop;
                        }
                    },
                });
            }
        }
    });

    descriptors.forEach((descriptor) => {
        Object.defineProperty(obj, descriptor.key, descriptor);
    });

    return obj;
}
