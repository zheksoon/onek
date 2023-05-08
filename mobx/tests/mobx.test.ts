import { computed, configure, Observable, observable, Reaction, tx } from "onek";
import { from, makeObservable, notify } from "../src";

const trackedUpdatesCounter = new WeakMap();

function trackUpdate(owner: any) {
    const value = trackedUpdatesCounter.get(owner) || 0;
    trackedUpdatesCounter.set(owner, value + 1);
}

function trackedUpdates(owner: any) {
    return trackedUpdatesCounter.get(owner) || 0;
}

configure({
    reactionScheduler: (runner) => runner(),
});

describe("makeObservable and related functions", () => {
    describe("makeObservable", () => {
        test("makeObservable doesn't throw for empty object", () => {
            expect(() => makeObservable({})).not.toThrow();

            class T {
                constructor() {
                    makeObservable(this);
                }
            }

            expect(() => new T()).not.toThrow();
        });

        test("makeObservable converts observable and computed on plain object", () => {
            const o: { a: number; b: number } = makeObservable({
                a: observable.prop(1),
                b: computed.prop(() => o.a + 1),
            });
            let c;
            const r = new Reaction(() => {
                c = o.b;
            });
            expect(() => r.run()).not.toThrow();
            expect(c).toBe(2);
            o.a = 2;
            expect(c).toBe(3);
        });

        test("makeObservable converts observable and computed on class objects", () => {
            class C {
                a = observable.prop(1);
                b = computed.prop(() => this.a + 1);

                constructor() {
                    makeObservable(this);
                }
            }

            const o = new C();
            let c;
            const r = new Reaction(() => {
                c = o.b;
            });
            expect(() => r.run()).not.toThrow();
            expect(c).toBe(2);
            o.a = 2;
            expect(c).toBe(3);
        });

        test("makeObservable only affects own properties", () => {
            const o: any = makeObservable({
                a: observable.box(1),
                __proto__: {
                    b: observable.box(2),
                },
            });
            expect(o.a).toBe(1);
            expect(o.b).toBeInstanceOf(Observable); // o.b is on proto, so don't get converted
        });

        test("makeObservable doesn't add setter for computed", () => {
            const o: any = makeObservable({
                a: observable.box(1),
                b: computed.box(() => o.a + 1),
            });
            // will throw in strict mode only
            expect(() => (o.b = 20)).toThrow();
            // check o.b is still a computed
            expect(o.b).toBe(2);
            o.a = 5;
            expect(o.b).toBe(6);
        });

        test("makeObservable doesn't change behaviour if applied twice (objects)", () => {
            const o: any = makeObservable(
                makeObservable({
                    a: observable.box(1),
                    b: computed.box(() => o.a + 1),
                })
            );

            let c;
            const r = new Reaction(() => {
                c = o.b;
            });
            expect(() => r.run()).not.toThrow();
            expect(c).toBe(2);
            o.a = 2;
            expect(c).toBe(3);
        });

        test("makeObservable doesn't change behaviour if applied twice (classes inheritance)", () => {
            class A {
                a = observable.prop(1);
                b = computed.prop(() => this.a + 1);

                constructor() {
                    makeObservable(this);
                }
            }

            class B extends A {
                c = computed.box(() => this.a + this.b);

                constructor() {
                    super();
                    makeObservable(this);
                }
            }

            const o = new B();
            let c;
            const r = new Reaction(() => {
                c = o.c;
            });
            expect(() => r.run()).not.toThrow();
            expect(c).toBe(3);
            o.a = 2;
            expect(c).toBe(5);
        });

        test("makeObservable doesn't execute getters", () => {
            let count = 0;
            const o = makeObservable({
                get a() {
                    return (count += 1);
                },
            });
            expect(count).toBe(0);
        });
    });

    describe("notify", () => {
        test("notify doesn't throw on empty thunk fn", () => {
            expect(() => notify(() => {})).not.toThrow();
        });

        test("notify calls .notify() on observables accessed in thunk fn", () => {
            const o = makeObservable({
                a: observable.prop(1),
                b: observable.prop(2),
            });

            const r1 = new Reaction(() => {
                trackUpdate(r1);
                o.a;
                o.b;
            });

            r1.run();

            expect(trackedUpdates(r1)).toBe(1);

            notify(() => o.a);

            expect(trackedUpdates(r1)).toBe(2);

            notify(() => {
                o.a;
                o.b;
            });

            expect(trackedUpdates(r1)).toBe(3);

            tx(() => {
                notify(() => {
                    o.a;
                    o.b;
                });
            });

            expect(trackedUpdates(r1)).toBe(4);
        });
    });

    describe("fromGetter", () => {
        test("fromGetter doesn't throw on empty thunk fn", () => {
            expect(() => from(() => {})).not.toThrow();
            expect(from(() => {})).toBe(undefined);
        });

        test("fromGetter returns observable or computed instance accessed on thunk fn", () => {
            const o = observable.prop(1);
            const c = computed.prop(() => o + 1);

            const obj = makeObservable({
                o,
                c,
            });

            expect(
                from(() => {
                    obj.o;
                })
            ).toBe(o);
            expect(
                from(() => {
                    obj.c;
                })
            ).toBe(c);
        });

        test("fromGetter returns observable or computed instance accessed on thunk fn (makeObservable)", () => {
            const o = observable.box(1);
            const c = computed.box(() => o.get() + 1);
            const oo = makeObservable({ o, c });
            expect(
                from(() => {
                    oo.o;
                })
            ).toBe(o);
            expect(
                from(() => {
                    oo.c;
                })
            ).toBe(c);
        });

        test("fromGetter returns latest accessed observable in thunk fn", () => {
            const o1 = observable.prop(1);
            const o2 = observable.prop(2);

            const obj = makeObservable({
                o1,
                o2,
            });
            expect(
                from(() => {
                    obj.o1;
                    obj.o2;
                })
            ).toBe(o2);
        });
    });
});
