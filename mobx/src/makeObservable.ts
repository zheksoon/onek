import { Computed, IGettable, Observable, tx } from "onek";

const enum GetterContext {
    NONE,
    INSTANCE,
    NOTIFY,
}

let getterContext = GetterContext.NONE;

function handleContext(prop: IGettable<any>): any {
    switch (getterContext) {
        case GetterContext.NONE:
            return prop.get();
        case GetterContext.INSTANCE:
            return prop;
        case GetterContext.NOTIFY:
            if (prop instanceof Observable) {
                prop.notify();
            }
            return;
    }
}

export function instance<T>(fn: () => T): T extends any[] ? IGettable<any>[] : IGettable<T> {
    const oldContext = getterContext;
    getterContext = GetterContext.INSTANCE;
    try {
        // @ts-ignore
        return fn();
    } finally {
        getterContext = oldContext;
    }
}

export function notify(thunk: () => any): void {
    const oldContext = getterContext;
    getterContext = GetterContext.NOTIFY;
    tx(() => {
        try {
            thunk();
        } finally {
            getterContext = oldContext;
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
                        return handleContext(prop);
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
                        return handleContext(prop);
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
