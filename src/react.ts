// @ts-ignore
import React, { useMemo, useSyncExternalStore } from "react";
import { Reaction, setSubscriber } from "./core";

type AnyComponent = Function & Record<string, any>;

const reactiveComponentsMap = new WeakMap<Function, Function>();
const isInBrowser = typeof window !== "undefined";

function shouldConstruct(Component: Function) {
    const prototype = Component.prototype;
    return !!(prototype && prototype.isReactComponent);
}

function makeCleanupComponent(component: AnyComponent) {
    const reactiveComponent = function () {
        try {
            return component.apply(this, arguments);
        } finally {
            setSubscriber(null);
        }
    };

    Object.assign(reactiveComponent, component);

    reactiveComponent.displayName = component.displayName || component.name;

    return reactiveComponent;
}

if (isInBrowser) {
    const originalCreateElement = React.createElement;

    React.createElement = function createElement() {
        const component = arguments[0];

        if (typeof component === "function") {
            let reactiveComponent = reactiveComponentsMap.get(component) as AnyComponent;

            if (!reactiveComponent) {
                if (shouldConstruct) {
                    reactiveComponent = component;
                } else {
                    reactiveComponent = makeCleanupComponent(component);
                }
                reactiveComponentsMap.set(component, reactiveComponent);
            }

            arguments[0] = reactiveComponent;
        }

        return originalCreateElement.apply(this, arguments);
    };
}

const EMPTY_ARRAY = [];
const ABANDONED_RENDER_TIMEOUT = 5000;

let abandonedRendersFutureItems = new Set<Reaction>();
let abandonedRendersCurrentItems = new Set<Reaction>();
let abandonedRendersCleanupTimeout: ReturnType<typeof setTimeout> | null = null;

function addAbandonedRenderCleanup(r: Reaction) {
    abandonedRendersFutureItems.add(r);
    if (!abandonedRendersCleanupTimeout) {
        abandonedRendersCleanupTimeout = setTimeout(() => {
            const items = abandonedRendersCurrentItems;
            abandonedRendersCurrentItems = abandonedRendersFutureItems;
            abandonedRendersFutureItems = new Set();

            items.forEach((r) => r._unsubscribe());
        }, ABANDONED_RENDER_TIMEOUT);
    }
}

function removeAbandonedRenderCleanup(r: Reaction) {
    abandonedRendersFutureItems.delete(r);
    abandonedRendersCurrentItems.delete(r);
}

export function useObserver(): void {
    if (!isInBrowser) {
        return;
    }

    const store = useMemo(() => {
        let revision = {};
        let subscribers = new Set<() => void>();
        let renderResult = null;
        let didUnsubscribe = false;

        const r = new Reaction(
            () => {},
            () => {
                revision = {};
                subscribers.forEach((notify) => notify());
            }
        );

        addAbandonedRenderCleanup(r);

        return {
            _subscribe(notify: () => void): () => void {
                if (didUnsubscribe && subscribers.size === 0) {
                    r._subscribe();

                    didUnsubscribe = false;
                }

                subscribers.add(notify);

                removeAbandonedRenderCleanup(r);

                return () => {
                    subscribers.delete(notify);

                    if (subscribers.size === 0) {
                        didUnsubscribe = true;

                        r._unsubscribe();
                    }
                };
            },
            _getRevision() {
                return revision;
            },
            _reaction: r,
        };
    }, EMPTY_ARRAY);

    useSyncExternalStore(store._subscribe, store._getRevision);

    setSubscriber(store._reaction);
}
