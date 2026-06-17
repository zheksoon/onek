import {
    action,
    CheckFn,
    Computed,
    configure,
    Disposer,
    IComputedGetter,
    Observable,
    Reaction,
    shallowEquals,
    tx,
    untracked,
    utx,
} from "../src";
import {
    Equals,
    IComputed,
    IObservable,
    IObservableGetter,
    ISetter,
    ReactionFn,
} from "../src/core";

const updatesMap = new WeakMap<any, number>();

const updates = (val: any) => updatesMap.get(val) ?? updatesMap.get(val.track) ?? 0;

const trackUpdate = (val: any) => {
    updatesMap.set(val, updates(val) + 1);
};

export function observable<T>(value: T, checkFn?: Equals<T>) {
    const obs = new Observable(value, checkFn);
    const get = obs.get.bind(obs) as IObservableGetter<T>;
    const set = obs.set.bind(obs) as ISetter<T>;

    get.instance = obs;
    get.revision = obs._getRevision.bind(obs);

    return [get, set] as const;
}

observable.box = <T>(value: T, checkFn?: Equals<T>): IObservable<T> => {
    return new Observable(value, checkFn);
};

observable.prop = <T>(value: T, checkFn?: Equals<T>): T => {
    return new Observable(value, checkFn) as unknown as T;
};

export function _computed<T>(fn: () => T, checkFn?: Equals<T>): IComputedGetter<T> {
    const comp = new Computed(fn, checkFn);
    const get = comp.get.bind(comp) as IComputedGetter<T>;

    get.instance = comp;
    get.destroy = comp.destroy.bind(comp);
    get.revision = comp._getRevision.bind(comp);

    return get;
}

_computed.box = <T>(fn: () => T, checkFn?: Equals<T>): IComputed<T> => {
    return new Computed(fn, checkFn);
};

_computed.prop = <T>(fn: () => T, checkFn?: Equals<T>): T => {
    return new Computed(fn, checkFn) as unknown as T;
};

const computed = <T>(fn: () => T, checkFn: CheckFn<T> = () => false) => {
    const comp = _computed(() => {
        trackUpdate(comp);
        return fn();
    }, checkFn);

    return comp;
};

export function _reaction(fn: ReactionFn, manager?: () => void): Disposer {
    const r = new Reaction(fn, manager);
    const destructor = r.destroy.bind(r) as Disposer;
    destructor.run = r.run.bind(r);

    r.run();

    return destructor;
}

const reaction = (fn: ReactionFn, manager?: () => void) => {
    const t = {};
    const r = _reaction(() => {
        trackUpdate(t);
        return fn();
    }, manager);

    // @ts-ignore
    r.track = t;

    return r;
};

const getCheck = () => {
    const check = (a: any, b: any) => {
        trackUpdate(check);
        return a === b;
    };

    return check;
};

beforeAll(() => {
    configure({
        reactionScheduler: (run) => run(),
    });
});

describe("observable", () => {
    it("creates observable value", () => {
        expect(() => {
            const [o1, seto1] = observable(1);
        }).not.toThrow();
    });

    it("reads and writes observable value", () => {
        const [o1, seto1] = observable(1);

        expect(o1()).toBe(1);

        seto1(2);

        expect(o1()).toBe(2);
    });

    it("calls checkFn on value set", () => {
        const check = getCheck();

        const [o1, seto1] = observable<number>(1, check);

        const r1 = reaction(() => {
            o1();
        });

        expect(updates(r1)).toBe(1);
        expect(updates(check)).toBe(0);

        seto1(2);

        expect(updates(r1)).toBe(2);
        expect(updates(check)).toBe(1);

        seto1(2);

        expect(updates(r1)).toBe(2);
        expect(updates(check)).toBe(2);

        r1();
    });

    it("defaults to shallowEqual when checkFn is boolean", () => {
        const [o1, seto1] = observable<number>(1, shallowEquals);

        const r1 = reaction(() => {
            o1();
        });

        expect(updates(r1)).toBe(1);

        seto1(2);

        expect(updates(r1)).toBe(2);

        seto1(2);

        expect(updates(r1)).toBe(2);

        r1();
    });

    it("updates value with updater fn", () => {
        const [o1, seto1] = observable(1);

        seto1((value) => value + 1);

        expect(o1()).toBe(2);
    });

    it("observable.box return instance of Observable", () => {
        const box = observable.box(1, shallowEquals);

        expect(box).toBeInstanceOf(Observable);
    });

    it("observable.prop return instance of Observable ignoring type", () => {
        const box = observable.prop(1, shallowEquals);

        expect(box).toBeInstanceOf(Observable);
    });
});

describe("computed", () => {
    it("creates computed", () => {
        expect(() => {
            computed(() => true);
        }).not.toThrow();
    });

    it("reads computed value", () => {
        const c1 = computed(() => 1);

        expect(updates(c1)).toBe(0);
        expect(c1()).toBe(1);
        expect(updates(c1)).toBe(1);

        expect(c1()).toBe(1);
        expect(updates(c1)).toBe(1);
    });

    it("caches result", () => {
        const [o1, seto1] = observable("hello");
        const c1 = computed(() => ({ data: o1() }));

        const res1 = c1();
        const res2 = c1();
        expect(res1).toStrictEqual({ data: "hello" });
        expect(res2).toBe(res1);
    });

    it("invalidates on observable changes", () => {
        const [o1, seto1] = observable(5);

        const c1 = computed(() => {
            return o1();
        });

        expect(c1()).toBe(5);
        expect(updates(c1)).toBe(1);

        seto1(10);

        expect(c1()).toBe(10);
        expect(updates(c1)).toBe(2);

        seto1(10);

        expect(c1()).toBe(10);
        expect(updates(c1)).toBe(2);
    });

    it("triangle 1", () => {
        const [o1, seto1] = observable(2);
        const c1 = computed(() => o1() * 2);
        const c2 = computed(() => o1() * c1());

        expect(c1()).toBe(4);
        expect(c2()).toBe(8);
        expect(updates(c1)).toBe(1);
        expect(updates(c2)).toBe(1);

        seto1(1);

        expect(c1()).toBe(2);
        expect(c2()).toBe(2);
        expect(updates(c1)).toBe(2);
        expect(updates(c2)).toBe(2);
    });

    it("triangle 2", () => {
        const [o1, seto1] = observable(2);
        const c1 = computed(() => o1() * 2);
        const c2 = computed(() => c1() * 2);
        const c3 = computed(() => o1() * c2());

        expect(c1()).toBe(4);
        expect(c2()).toBe(8);
        expect(c3()).toBe(16);
        expect(updates(c1)).toBe(1);
        expect(updates(c2)).toBe(1);
        expect(updates(c3)).toBe(1);

        seto1(1);

        expect(c1()).toBe(2);
        expect(c2()).toBe(4);
        expect(c3()).toBe(4);
        expect(updates(c1)).toBe(2);
        expect(updates(c2)).toBe(2);
        expect(updates(c3)).toBe(2);
    });

    it("diamond 1", () => {
        const [o1, seto1] = observable(1);
        const c1 = computed(() => o1() * 2);
        const c2 = computed(() => o1() * 3);
        const c3 = computed(() => c1() + c2());

        expect(c3()).toBe(5);
        expect(c2()).toBe(3);
        expect(c1()).toBe(2);
        expect(updates(c1)).toBe(1);
        expect(updates(c2)).toBe(1);
        expect(updates(c3)).toBe(1);

        seto1(2);

        expect(c3()).toBe(10);
        expect(updates(c1)).toBe(2);
        expect(updates(c2)).toBe(2);
        expect(updates(c3)).toBe(2);
    });

    it("diamond 2", () => {
        const [o1, seto1] = observable(1);
        const c11 = computed(() => o1() * 2);
        const c12 = computed(() => o1() * 3);
        const c21 = computed(() => c11() * 2);
        const c22 = computed(() => c12() * 2);
        const c3 = computed(() => c21() + c22());

        expect(c3()).toBe(10);
        expect(updates(c3)).toBe(1);
        expect(updates(c21)).toBe(1);
        expect(updates(c22)).toBe(1);
        expect(updates(c11)).toBe(1);
        expect(updates(c12)).toBe(1);

        seto1(2);

        expect(c3()).toBe(20);
        expect(updates(c3)).toBe(2);
        expect(updates(c21)).toBe(2);
        expect(updates(c22)).toBe(2);
        expect(updates(c11)).toBe(2);
        expect(updates(c12)).toBe(2);
    });

    describe("conditional dependencies", () => {
        it("unsubscribes from conditional dependency on invalidation - observable", () => {
            const [o1, seto1] = observable(true);
            const [o2, seto2] = observable(2);
            const [o3, seto3] = observable(3);

            const c1 = computed(() => (o1() ? o2() : o3()));

            expect(c1()).toBe(2);
            expect(updates(c1)).toBe(1);

            seto2(20);
            expect(c1()).toBe(20);
            expect(updates(c1)).toBe(2);

            seto1(false);
            expect(c1()).toBe(3);
            expect(updates(c1)).toBe(3);

            seto2(2);
            expect(c1()).toBe(3);
            expect(updates(c1)).toBe(3);
        });

        it("unsubscribes from conditional dependency on invalidation - computed", () => {
            const [cond0, setcond0] = observable(false);
            const [o1, seto1] = observable(5);
            const [o2, seto2] = observable(10);
            const cond1 = computed(() => !cond0());
            const c1 = computed(() => o1() + 1);
            const c2 = computed(() => o2() + 1);
            const c3 = computed(() => (cond1() ? c1() : c2()));

            expect(c3()).toBe(6);
            expect(updates(c3)).toBe(1);

            // dependency - should update
            seto1(7);
            expect(c3()).toBe(8);
            expect(updates(c3)).toBe(2);

            // no dependency - shouldn't update
            seto2(11);
            expect(c3()).toBe(8);
            expect(updates(c3)).toBe(2);

            // dependency - should update
            setcond0(true);
            expect(c3()).toBe(12);
            expect(updates(c3)).toBe(3);

            // not a dependency now
            seto1(5);
            expect(c3()).toBe(12);
            expect(updates(c3)).toBe(3);

            // dependency
            seto2(10);
            expect(c3()).toBe(11);
            expect(updates(c3)).toBe(4);
        });

        it("invalidated by conditional computed dependence (many)", () => {
            const obs = new Array(128).fill(0).map((_, i) => observable(i));
            const comp = obs.map((o) => computed(() => o[0]()));
            const [selector, setselector] = observable(0);
            const value = computed(() => {
                return comp[selector()]();
            });

            for (let i = 0; i < 128; i++) {
                setselector(i);
                expect(value()).toBe(i);

                obs[(i - 1) & 127][1](i - 1);
                expect(value()).toBe(i);

                obs[(i + 1) & 127][1](i + 1);
                expect(value()).toBe(i);
            }
        });

        it("subscribes to computed only once", () => {
            const [o1, seto1] = observable(1);
            const c1 = computed(() => o1() * 2);
            const c2 = computed(() => c1() + c1());

            expect(c2()).toBe(4);
            expect(updates(c2)).toBe(1);

            seto1(2);
            expect(c2()).toBe(8);
            expect(updates(c2)).toBe(2);
        });
    });

    describe("value-checked", () => {
        it("calls checkFn on dependency update", () => {
            const check = getCheck();

            const [o1, seto1] = observable(1);
            const c1 = computed(() => Math.abs(o1()), check);

            expect(c1()).toBe(1);
            expect(updates(c1)).toBe(1);
            expect(updates(check)).toBe(0);

            seto1(2);

            expect(c1()).toBe(2);
            expect(updates(c1)).toBe(2);
            expect(updates(check)).toBe(1);

            seto1(-2);

            expect(c1()).toBe(2);
            expect(updates(c1)).toBe(3);
            expect(updates(check)).toBe(2);
        });

        it("uses default shallowEquals when checkFn is boolean", () => {
            const [o1, seto1] = observable(1);

            const c1 = computed(() => o1() * 2, shallowEquals);

            const r1 = reaction(() => {
                c1();
            });

            expect(updates(r1)).toBe(1);

            seto1(2);

            expect(updates(r1)).toBe(2);

            seto1(2);

            expect(updates(r1)).toBe(2);

            r1();
        });

        it("next computed in chain not recomputed when value does not change, o -> v -> c", () => {
            const check = getCheck();

            const [o1, seto1] = observable(1);
            const c1 = computed(() => Math.abs(o1()), check);
            const c2 = computed(() => c1() * 2);

            expect(c2()).toBe(2);
            expect(updates(c2)).toBe(1);
            expect(updates(c1)).toBe(1);
            expect(updates(check)).toBe(0);

            seto1(2);

            expect(c2()).toBe(4);
            expect(updates(c2)).toBe(2);
            expect(updates(c1)).toBe(2);
            expect(updates(check)).toBe(1);

            seto1(-2);

            expect(c2()).toBe(4);
            expect(updates(c2)).toBe(2);
            expect(updates(c1)).toBe(3);
            expect(updates(check)).toBe(2);
        });

        it("next computed in chain not recomputed when value does not change, o -> v -> c -> c", () => {
            const check = getCheck();

            const [o1, seto1] = observable(1);
            const c1 = computed(() => Math.abs(o1()), check);
            const c2 = computed(() => c1() * 2);
            const c3 = computed(() => c2());

            expect(c3()).toBe(2);
            expect(updates(c3)).toBe(1);
            expect(updates(c2)).toBe(1);
            expect(updates(c1)).toBe(1);
            expect(updates(check)).toBe(0);

            seto1(2);

            expect(c3()).toBe(4);
            expect(updates(c3)).toBe(2);
            expect(updates(c2)).toBe(2);
            expect(updates(c1)).toBe(2);
            expect(updates(check)).toBe(1);

            seto1(-2);

            expect(c3()).toBe(4);
            expect(updates(c3)).toBe(2);
            expect(updates(c2)).toBe(2);
            expect(updates(c1)).toBe(3);
            expect(updates(check)).toBe(2);
        });

        it("next computed in chain not recomputed when value does not change, o -> v -> v", () => {
            const check1 = getCheck();
            const check2 = getCheck();

            const [o1, seto1] = observable(1);
            const c1 = computed(() => Math.abs(o1()) - 2, check1);
            const c2 = computed(() => Math.abs(c1()) - 2, check2);

            expect(c2()).toBe(-1);
            expect(c1()).toBe(-1);
            expect(updates(c2)).toBe(1);
            expect(updates(c1)).toBe(1);
            expect(updates(check1)).toBe(0);
            expect(updates(check2)).toBe(0);

            // c1 recalculates, c2 not, no changes
            seto1(-1);

            expect(c2()).toBe(-1);
            expect(c1()).toBe(-1);
            expect(updates(c2)).toBe(1);
            expect(updates(c1)).toBe(2);
            expect(updates(check1)).toBe(1);
            expect(updates(check2)).toBe(0);

            // c1 and c2 recalculate, c1 changes
            seto1(3);

            expect(c2()).toBe(-1);
            expect(c1()).toBe(1);
            expect(updates(c2)).toBe(2);
            expect(updates(c1)).toBe(3);
            expect(updates(check1)).toBe(2);
            expect(updates(check2)).toBe(1);

            // c1 and c2 recalculate, c1 and c2 change
            seto1(5);

            expect(c2()).toBe(1);
            expect(c1()).toBe(3);
            expect(updates(c2)).toBe(3);
            expect(updates(c1)).toBe(4);
            expect(updates(check1)).toBe(3);
            expect(updates(check2)).toBe(2);
        });

        it("chain o -> c -> v -> r", () => {
            const check1 = getCheck();

            const [o1, seto1] = observable(0);
            const c1 = computed(() => {
                return o1() * 2;
            });

            const c2 = computed(() => {
                return c1() * 2;
            }, check1);

            const r1 = reaction(() => {
                c2();
            });

            expect(updates(c1)).toBe(1);
            expect(updates(c2)).toBe(1);
            expect(updates(r1)).toBe(1);

            seto1(0); // same value

            expect(updates(c1)).toBe(1);
            expect(updates(c2)).toBe(1);
            expect(updates(r1)).toBe(1);

            seto1(1); // new value

            expect(updates(c1)).toBe(2);
            expect(updates(c2)).toBe(2);
            expect(updates(r1)).toBe(2);

            seto1(2); // new value
            expect(updates(c1)).toBe(3);
            expect(updates(c2)).toBe(3);
            expect(updates(r1)).toBe(3);
        });

        it("chain o -> c -> v -> c -> r", () => {
            const check2 = getCheck();

            const [o1, seto1] = observable(1);

            const c1 = computed(() => {
                return o1() * 2;
            });

            const c2 = computed(() => {
                return c1() * 2;
            }, check2);

            const c3 = computed(() => {
                return c2() * 2;
            });

            const r1 = reaction(() => {
                c3();
            });

            expect(updates(c1)).toBe(1);
            expect(updates(c2)).toBe(1);
            expect(updates(c3)).toBe(1);
            expect(updates(r1)).toBe(1);

            seto1(2); // new value

            expect(updates(c1)).toBe(2);
            expect(updates(c2)).toBe(2);
            expect(updates(c3)).toBe(2);
            expect(updates(r1)).toBe(2);

            seto1(1); // same value after new value
            expect(updates(c1)).toBe(3);
            expect(updates(c2)).toBe(3);
            expect(updates(c3)).toBe(3);
            expect(updates(r1)).toBe(3);
        });

        it("chain o -> v -> v -> r", () => {
            const check1 = getCheck();
            const check2 = getCheck();

            const [o1, seto1] = observable(0);
            const c1 = computed(() => {
                return o1() * 2;
            }, check1);

            const c2 = computed(() => {
                return c1() * 2;
            }, check2);

            const r1 = reaction(() => {
                c2();
            });

            expect(updates(c1)).toBe(1);
            expect(updates(c2)).toBe(1);
            expect(updates(r1)).toBe(1);

            seto1(0);

            expect(updates(c1)).toBe(1);
            expect(updates(c2)).toBe(1);
            expect(updates(r1)).toBe(1);

            seto1(1);

            expect(updates(c1)).toBe(2);
            expect(updates(c2)).toBe(2);
            expect(updates(r1)).toBe(2);

            seto1(1);

            expect(updates(c1)).toBe(2);
            expect(updates(c2)).toBe(2);
            expect(updates(r1)).toBe(2);
        });

        it("chain o -> v -> v -> r (2)", () => {
            const check1 = getCheck();
            const check2 = getCheck();

            const [o1, seto1] = observable(0);

            const c1 = computed(() => {
                return Math.abs(o1());
            }, check1);

            const c2 = computed(() => {
                return Math.abs(c1() - 2);
            }, check2);

            const r1 = reaction(() => {
                c2();
            });

            expect(c2()).toBe(2);
            expect(updates(c1)).toBe(1);
            expect(updates(c2)).toBe(1);
            expect(updates(r1)).toBe(1);

            seto1(1);

            expect(c2()).toBe(1);
            expect(updates(c1)).toBe(2);
            expect(updates(c2)).toBe(2);
            expect(updates(r1)).toBe(2);

            seto1(-1);

            expect(c2()).toBe(1);
            expect(updates(c1)).toBe(3);
            expect(updates(c2)).toBe(2);
            expect(updates(r1)).toBe(2);

            seto1(5);

            expect(c2()).toBe(3);
            expect(updates(c1)).toBe(4);
            expect(updates(c2)).toBe(3);
            expect(updates(r1)).toBe(3);

            seto1(1);

            expect(c2()).toBe(1);
            expect(updates(c1)).toBe(5);
            expect(updates(c2)).toBe(4);
            expect(updates(r1)).toBe(4);
        });

        it("reaction is not triggered if value does not change mid-chain, o -> v -> c -> r", () => {
            const check = getCheck();
            const [o1, seto1] = observable(1);
            const c1 = computed(() => Math.abs(o1()), check);
            const c2 = computed(() => c1() * 2);

            let runCount = 0;
            const r1 = reaction(() => {
                c2();
                runCount++;
            });

            expect(c2()).toBe(2);
            expect(updates(c2)).toBe(1);
            expect(updates(c1)).toBe(1);
            expect(runCount).toBe(1);

            // change value, mid-chain changes
            seto1(2);
            expect(c2()).toBe(4);
            expect(updates(c2)).toBe(2);
            expect(updates(c1)).toBe(2);
            expect(runCount).toBe(2);

            // change value, mid-chain does NOT change
            seto1(-2);
            expect(c2()).toBe(4);
            expect(updates(c2)).toBe(2); // should not recompute c2
            expect(updates(c1)).toBe(3); // c1 recomputes
            expect(runCount).toBe(2); // reaction should not run
        });

        it("reaction is not triggered if value does not change mid-chain with multiple value-checked, o -> v -> v -> r", () => {
            const check1 = getCheck();
            const check2 = getCheck();
            const [o1, seto1] = observable(1);
            const c1 = computed(() => Math.abs(o1()) - 2, check1);
            const c2 = computed(() => Math.abs(c1()) - 2, check2);

            let runCount = 0;
            const r1 = reaction(() => {
                c2();
                runCount++;
            });

            expect(c2()).toBe(-1);
            expect(updates(c2)).toBe(1);
            expect(updates(c1)).toBe(1);
            expect(runCount).toBe(1);

            // c1 recalculates, c2 not, no changes
            seto1(-1);
            expect(c2()).toBe(-1);
            expect(updates(c2)).toBe(1); // c2 should not run
            expect(updates(c1)).toBe(2); // c1 runs
            expect(runCount).toBe(1); // reaction should not run
        });

        it("reaction is triggered only for changed branch in a diamond with a mid-chain value-checked check, o -> c1/c2 -> c3 -> r", () => {
            const check = getCheck();
            const [o1, seto1] = observable(1);

            // c1 changes value on any o1 change
            const c1 = computed(() => o1() * 2);
            // c2 is value-checked and does not change value for absolute o1 change
            const c2 = computed(() => Math.abs(o1()), check);

            // c3 depends on both
            const c3 = computed(() => c1() + c2());

            let runCount = 0;
            const r1 = reaction(() => {
                c3();
                runCount++;
            });

            expect(c3()).toBe(3); // 2 + 1
            expect(updates(c1)).toBe(1);
            expect(updates(c2)).toBe(1);
            expect(updates(c3)).toBe(1);
            expect(runCount).toBe(1);

            // Change o1 to -1.
            // c1 becomes -2 (changed).
            // c2 remains 1 (unchanged).
            seto1(-1);

            expect(c3()).toBe(-1); // -2 + 1
            expect(updates(c1)).toBe(2); // c1 recomputed
            expect(updates(c2)).toBe(2); // c2 recomputed but did not change revision
            expect(updates(c3)).toBe(2); // c3 recomputed because c1 changed
            expect(runCount).toBe(2); // reaction ran
        });

        it("transaction test 1", () => {
            const check1 = getCheck();

            const [o1, seto1] = observable(0);
            const [o2, seto2] = observable(1);

            const c1 = computed(() => {
                return o1() + o2();
            }, check1);

            const r1 = reaction(() => {
                c1();
            });

            expect(updates(r1)).toBe(1);
            expect(updates(c1)).toBe(1);

            tx(() => {
                seto1(1);
                seto2(2);
            });

            expect(updates(r1)).toBe(2);
            expect(updates(c1)).toBe(2);

            tx(() => {
                seto1(5);
                expect(c1()).toBe(5 + 2);
                expect(updates(c1)).toBe(3);
                expect(updates(r1)).toBe(2);
                seto2(6);
            });

            expect(updates(c1)).toBe(4);
            expect(updates(r1)).toBe(3);

            // no change to sum
            tx(() => {
                seto1(6);
                seto2(5);
            });

            expect(updates(c1)).toBe(5);
            expect(updates(r1)).toBe(3);
        });

        it("observable branching 1", () => {
            const check1 = getCheck();

            const [o1, seto1] = observable(0);
            const [o2, seto2] = observable(1);

            const c1 = computed(() => {
                return o1() * 2;
            }, check1);

            const c2 = computed(() => {
                return c1() + o2();
            });

            const r1 = reaction(() => {
                c2();
            });

            expect(updates(c1)).toBe(1);
            expect(updates(c2)).toBe(1);
            expect(updates(r1)).toBe(1);

            seto1(0);

            expect(updates(c1)).toBe(1);
            expect(updates(c2)).toBe(1);
            expect(updates(r1)).toBe(1);

            seto2(2);

            expect(updates(c1)).toBe(1);
            expect(updates(c2)).toBe(2);
            expect(updates(r1)).toBe(2);

            seto1(1);

            expect(updates(c1)).toBe(2);
            expect(updates(c2)).toBe(3);
            expect(updates(r1)).toBe(3);
        });

        it("diamond 1", () => {
            const check1 = getCheck();
            const check2 = getCheck();

            const [o1, seto1] = observable(0);

            const c1 = computed(() => {
                return o1() * 2;
            }, check1);

            const c2 = computed(() => {
                return o1() + 1;
            }, check2);

            const r1 = reaction(() => {
                c1();
                c2();
            });

            expect(updates(c1)).toBe(1);
            expect(updates(c2)).toBe(1);
            expect(updates(r1)).toBe(1);

            seto1(0);

            expect(updates(c1)).toBe(1);
            expect(updates(c2)).toBe(1);
            expect(updates(r1)).toBe(1);

            seto1(1);

            expect(updates(c1)).toBe(2);
            expect(updates(c2)).toBe(2);
            expect(updates(r1)).toBe(2);
        });

        it("triangle 1", () => {
            const check1 = getCheck();
            const check2 = getCheck();

            const [o1, seto1] = observable(0);

            const c1 = computed(() => {
                return o1() * 2;
            }, check1);

            const c2 = computed(() => {
                return o1() + c1();
            }, check2);

            const r1 = reaction(() => {
                c2();
            });

            expect(updates(c1)).toBe(1);
            expect(updates(c2)).toBe(1);
            expect(updates(r1)).toBe(1);

            seto1(0);

            expect(updates(c1)).toBe(1);
            expect(updates(c2)).toBe(1);
            expect(updates(r1)).toBe(1);

            seto1(1);

            expect(updates(c1)).toBe(2);
            expect(updates(c2)).toBe(2);
            expect(updates(r1)).toBe(2);
        });

        it("multiple sources", () => {
            const [o1, seto1] = observable(1);
            const [o2, seto2] = observable(2);

            const c1 = computed(() => o1() * 2, shallowEquals);
            const c2 = computed(() => o2() * 2, shallowEquals);

            const c3 = computed(() => c1() + c2());

            const r1 = reaction(() => {
                c3();
            });

            expect(updates(r1)).toBe(1);
            expect(c3()).toBe(6);

            tx(() => {
                seto1(2);
                seto2(3);
            });

            expect(updates(r1)).toBe(2);
            expect(c3()).toBe(10);

            r1();
        });
    });

    it("throws when has recursive dependencies", () => {
        const c1: IComputedGetter<number> = computed(() => {
            return c1() * 2;
        });

        expect(() => {
            c1();
        }).toThrow();
    });

    it("throws when has recursive dependencies", () => {
        const c1: IComputedGetter<number> = computed(() => {
            return c2() * 2;
        });

        const c2: IComputedGetter<number> = computed(() => {
            return c1() + 1;
        });

        expect(() => {
            c1();
        }).toThrow();

        expect(() => {
            c2();
        }).toThrow();
    });

    it("rethrows exceptions", () => {
        const c1 = computed(() => {
            throw new Error("boom!");
        });

        expect(() => {
            c1();
        }).toThrow();
    });

    it("restores after exception", () => {
        const [o1, seto1] = observable(10);
        const c1 = computed(() => {
            if (o1() < 0) {
                throw new Error("less than zero");
            }
            return o1() * 2;
        });

        expect(c1()).toBe(20);

        seto1(-1);
        expect(() => {
            c1();
        }).toThrow();
        // throws the second time as well
        expect(() => {
            c1();
        }).toThrow();

        // restores after exception
        seto1(5);
        expect(c1()).toBe(10);
    });

    it("throws when trying to change observable inside of computed", () => {
        const [o1, seto1] = observable(0);
        const [o2, seto2] = observable(1);

        const c1 = computed(() => {
            seto2(o1() + o2());
        });

        expect(() => {
            c1();
        }).toThrow();
    });

    it("not propagates state when dirty", () => {
        const [o1, seto1] = observable(1);
        const [o2, seto2] = observable(2);

        const c1 = computed(() => Math.abs(o1()), getCheck());
        const c2 = computed(() => Math.abs(o2()), getCheck());
        const c3 = computed(() => c1() + c2(), getCheck());

        expect(c3()).toBe(3);

        tx(() => {
            seto1(10);
            seto2(20);
        });

        expect(c3()).toBe(30);
    });

    it("destroy method invalidates computed", () => {
        const [o, seto] = observable(1);
        const c = computed(() => {
            return o() + 1;
        });
        c();
        expect(updates(c)).toBe(1);
        c.destroy();
        expect(updates(c)).toBe(1);
        c();
        expect(updates(c)).toBe(2);
    });

    describe("passive state", () => {
        it("passive computed is garbage collected when not referenced", async () => {
            const [o1, seto1] = observable(0);

            let c1: IComputedGetter<number> | null = computed(() => o1() * 2);

            const weakRef = new WeakRef(c1);

            c1();

            // Release the strong reference to the object
            c1 = null;

            // Run garbage collection if it's available
            for (let i = 0; i < 10; i++) {
                global.gc?.();
                await new Promise((r) => setTimeout(r, 50));
            }

            // Check if the object was garbage-collected
            expect(weakRef.deref()).toBeUndefined();
        });

        it("resurrects when somebody is subscribed", () => {
            const [o1, seto1] = observable(1);
            const [o2, seto2] = observable(false);

            const c1 = computed(() => o1() * 2);

            const r1 = reaction(() => {
                if (o2()) {
                    c1();
                }
            });

            c1();

            expect(updates(c1)).toBe(1);
            expect(updates(r1)).toBe(1);

            seto2(true);

            expect(updates(c1)).toBe(1);
            expect(updates(r1)).toBe(2);

            seto1(2);

            expect(updates(c1)).toBe(2);
            expect(updates(r1)).toBe(3);

            r1();
        });
    });

    it("computed.box returns instance of Computed", () => {
        const c1 = _computed.box(() => 1, shallowEquals);

        expect(c1).toBeInstanceOf(Computed);
    });

    it("computed.prop returns instance of Computed (ignoring type)", () => {
        const c1 = _computed.prop(() => 1);

        expect(c1).toBeInstanceOf(Computed);
    });
});

describe("reaction", () => {
    it("reacts to observable changes", () => {
        const [o1, seto1] = observable(1);

        let r1: Disposer | null = null;

        expect(() => {
            r1 = reaction(() => {
                o1();
            });
        }).not.toThrow();
        expect(updates(r1)).toBe(1);

        seto1(2);

        expect(updates(r1)).toBe(2);

        seto1(2);

        expect(updates(r1)).toBe(2);

        // @ts-ignore
        r1 && r1();
    });

    it("reacts to computed changes", () => {
        const [o1, seto1] = observable(1);

        const c1 = computed(() => o1() * 2);

        const r1 = reaction(() => {
            c1();
        });

        expect(updates(c1)).toBe(1);
        expect(updates(r1)).toBe(1);

        seto1(2);

        expect(updates(c1)).toBe(2);
        expect(updates(r1)).toBe(2);

        seto1(2);

        expect(updates(c1)).toBe(2);
        expect(updates(r1)).toBe(2);

        r1.run();

        expect(updates(c1)).toBe(2);
        expect(updates(r1)).toBe(3);

        r1();
    });

    it("reacts to computed changes, 2 computeds chain", () => {
        const [o1, seto1] = observable(1);

        const c1 = computed(() => o1() * 2);

        const c2 = computed(() => c1() * 2);

        expect(c1()).toBe(2);
        expect(c2()).toBe(4);
        expect(updates(c1)).toBe(1);
        expect(updates(c2)).toBe(1);

        seto1(2);

        expect(c1()).toBe(4);
        expect(c2()).toBe(8);
        expect(updates(c1)).toBe(2);
        expect(updates(c2)).toBe(2);

        c2();

        expect(updates(c1)).toBe(2);
        expect(updates(c2)).toBe(2);
    });

    it("throws when runs in infinite loop", () => {
        const [o1, seto1] = observable(1);

        expect(() => {
            reaction(() => {
                seto1(o1() + 1);
            });
        }).toThrow();
    });

    it("runs manager function instead of reaction body", () => {
        const [o1, seto1] = observable(1);

        const manager = () => {
            trackUpdate(manager);
        };

        const body = () => {
            trackUpdate(body);
            o1();
        };

        const r = reaction(body, manager);

        expect(updates(manager)).toBe(0);
        expect(updates(body)).toBe(1);

        seto1(2);

        expect(updates(manager)).toBe(1);
        expect(updates(body)).toBe(1);

        seto1(3);

        expect(updates(manager)).toBe(1);
        expect(updates(body)).toBe(1);
    });

    it("executes destructor fn", () => {
        const [o1, seto1] = observable(1);

        const destructor = () => {
            trackUpdate(destructor);
        };

        const r1 = reaction(() => {
            o1();

            return destructor;
        });

        expect(updates(r1)).toBe(1);
        expect(updates(destructor)).toBe(0);

        r1();

        expect(updates(r1)).toBe(1);
        expect(updates(destructor)).toBe(1);
    });

    it("scheduled reaction doesn't run when destroyed", () => {
        const [o1, seto1] = observable(1);

        const r1 = reaction(() => {
            o1();
        });

        expect(updates(r1)).toBe(1);

        seto1(2);

        expect(updates(r1)).toBe(2);

        tx(() => {
            seto1(3);
            r1();
        });

        expect(updates(r1)).toBe(2);
    });
});

describe("untracked", () => {
    it("makes observable access untracked", () => {
        const [o1, seto1] = observable(1);
        const [o2, seto2] = observable(2);

        let value: number | null = null;

        const r1 = reaction(() => {
            o1();
            value = untracked(() => o2());
        });

        expect(updates(r1)).toBe(1);
        expect(value).toBe(2);

        seto2(3);

        expect(updates(r1)).toBe(1);
        expect(value).toBe(2);
    });
});
describe("tx", () => {
    it("runs reactions after transaction is ended", () => {
        const [o1, seto1] = observable(1);
        const [o2, seto2] = observable(2);

        const r1 = reaction(() => {
            o1() + o2();
        });

        expect(updates(r1)).toBe(1);

        tx(() => {
            seto1(10);
            seto2(20);
        });

        expect(updates(r1)).toBe(2);
    });

    it("nested transactions", () => {
        const [o1, seto1] = observable(1);
        const [o2, seto2] = observable(2);

        const r1 = reaction(() => {
            o1() + o2();
        });

        expect(updates(r1)).toBe(1);

        tx(() => {
            seto1(10);

            tx(() => {
                seto1(100);
                seto2(200);
            });
            expect(updates(r1)).toBe(1);

            seto2(20);
        });

        expect(updates(r1)).toBe(2);
    });

    it("intermediate computed values are correct", () => {
        const [o1, seto1] = observable(1);
        const [o2, seto2] = observable(2);

        const c1 = computed(() => o1() + o2());

        expect(c1()).toBe(3);
        expect(updates(c1)).toBe(1);

        tx(() => {
            seto1(10);
            expect(c1()).toBe(12);
            expect(updates(c1)).toBe(2);
            seto2(20);
            expect(c1()).toBe(30);
            expect(updates(c1)).toBe(3);
        });

        expect(c1()).toBe(30);
        expect(updates(c1)).toBe(3);
    });

    it("intermediate computed values are correct, value-checked computed", () => {
        const [o1, seto1] = observable(1);
        const [o2, seto2] = observable(2);

        const check = getCheck();
        const c1 = computed(() => o1() + o2(), check);

        expect(c1()).toBe(3);
        expect(updates(c1)).toBe(1);

        tx(() => {
            seto1(10);
            expect(c1()).toBe(12);
            expect(updates(c1)).toBe(2);
            seto2(20);
            expect(c1()).toBe(30);
            expect(updates(c1)).toBe(3);
        });

        expect(c1()).toBe(30);
        expect(updates(c1)).toBe(3);
    });
});

describe("utx", () => {
    it("works like transaction", () => {
        const [o1, seto1] = observable(1);
        const [o2, seto2] = observable(2);

        const r1 = reaction(() => {
            o1() + o2();
        });

        expect(updates(r1)).toBe(1);

        utx(() => {
            seto1(10);
            seto2(20);
        });

        expect(updates(r1)).toBe(2);
    });

    it("value access is untracked", () => {
        const [o1, seto1] = observable(1);
        const [o2, seto2] = observable(2);

        const r1 = reaction(() => {
            o1();
            utx(() => o2());
        });

        expect(updates(r1)).toBe(1);

        seto1(10);

        expect(updates(r1)).toBe(2);

        seto2(20);

        expect(updates(r1)).toBe(2);
    });

    it("returns value from thunk", () => {
        const [o1, seto1] = observable(1);

        expect(utx(() => o1())).toBe(1);
    });
});

describe("action", () => {
    it("creates usable function", () => {
        const a1 = action(() => {});

        expect(() => a1()).not.toThrow();
    });

    it("acts like utx", () => {
        const [o1, seto1] = observable(1);
        const [o2, seto2] = observable(2);

        const a1 = action(() => o2());

        expect(a1()).toBe(2);

        const r1 = reaction(() => {
            o1();
            a1();
        });

        expect(updates(r1)).toBe(1);

        seto2(20);

        expect(updates(r1)).toBe(1);
    });

    it("passes arguments and returns value", () => {
        let _args: any[] | null = null;

        const a1 = action((...args: any[]) => {
            _args = args;
            return "hello";
        });

        expect(a1(1, "world")).toBe("hello");
        expect(_args).toStrictEqual([1, "world"]);
    });

    it("applies this", () => {
        let _this: any;

        const obj = {
            a: action(function (this: any) {
                _this = this;
            }),
        };

        obj.a();

        expect(_this).toBe(obj);
    });
});

describe("configure", () => {
    describe("reactionScheduler", () => {
        it("sets custom reaction scheduler", () => {
            const custom = (runner: () => void) => {
                trackUpdate(custom);
                runner();
            };

            configure({ reactionScheduler: custom });

            const [o1, seto1] = observable(1);
            const r1 = reaction(() => {
                o1();
            });

            expect(updates(custom)).toBe(0);

            seto1(2);

            expect(updates(custom)).toBe(1);

            configure({ reactionScheduler: (runner) => runner() });
        });

        it("microtask scheduler works as expected", async () => {
            const microtask = (runner: () => void) => {
                trackUpdate(microtask);
                Promise.resolve().then(runner);
            };

            configure({ reactionScheduler: microtask });

            const [o1, seto1] = observable(1);
            const [o2, seto2] = observable(2);

            const r1 = reaction(() => {
                o1() + o2();
            });

            expect(updates(r1)).toBe(1);
            expect(updates(microtask)).toBe(0);

            seto1(10);

            expect(updates(microtask)).toBe(1);

            seto2(20);

            // does not run synchronously
            expect(updates(r1)).toBe(1);
            expect(updates(microtask)).toBe(1);

            await Promise.resolve();

            expect(updates(r1)).toBe(2);
            expect(updates(microtask)).toBe(1);

            configure({ reactionScheduler: (runner) => runner() });
        });
    });

    describe("reactionExceptionHandler", () => {
        const error = console.error;

        beforeAll(() => {
            console.error = jest.fn();
        });

        afterAll(() => {
            console.error = error;
        });

        it("default handler does console.log", () => {
            const [o1, seto1] = observable(1);

            const r1 = reaction(() => {
                if (o1() > 10) {
                    throw new Error("too much");
                }
            });

            expect(console.error).not.toHaveBeenCalled();

            seto1(20);

            expect(console.error).toHaveBeenCalled();
        });

        it("sets custom handler", () => {
            const handler = jest.fn();

            configure({
                reactionExceptionHandler: handler,
            });

            const [o1, seto1] = observable(1);

            const r1 = reaction(() => {
                if (o1() > 10) {
                    throw new Error("too much");
                }
            });

            expect(handler).not.toHaveBeenCalled();

            seto1(20);

            expect(handler).toHaveBeenCalled();
        });
    });
});

describe("shallowEquals", () => {
    test("primitives: equal values", () => {
        expect(shallowEquals(42, 42)).toBe(true);
        expect(shallowEquals("hello", "hello")).toBe(true);
        expect(shallowEquals(null, null)).toBe(true);
        expect(shallowEquals(undefined, undefined)).toBe(true);
        expect(shallowEquals(true, true)).toBe(true);
        expect(shallowEquals(false, false)).toBe(true);
    });

    test("primitives: unequal values", () => {
        expect(shallowEquals(42, 24)).toBe(false);
        expect(shallowEquals("hello", "world")).toBe(false);
        expect(shallowEquals(null, undefined)).toBe(false);
        expect(shallowEquals(true, false)).toBe(false);
    });

    test("arrays: equal shallow arrays", () => {
        expect(shallowEquals([1, 2, 3], [1, 2, 3])).toBe(true);
        expect(shallowEquals(["a", "b", "c"], ["a", "b", "c"])).toBe(true);
        expect(shallowEquals([true, false], [true, false])).toBe(true);
    });

    test("arrays: unequal shallow arrays", () => {
        expect(shallowEquals([1, 2, 3], [1, 2, 4])).toBe(false);
        expect(shallowEquals(["a", "b", "c"], ["a", "b"])).toBe(false);
        expect(shallowEquals([true, false], [false, shallowEquals])).toBe(false);
    });

    test("plain objects: equal shallow objects", () => {
        expect(shallowEquals({ a: 1, b: 2 }, { a: 1, b: 2 })).toBe(true);
        expect(shallowEquals({ a: "hello", b: "world" }, { a: "hello", b: "world" })).toBe(true);
        expect(shallowEquals({ a: true, b: false }, { a: true, b: false })).toBe(true);
    });

    test("plain objects: unequal shallow objects", () => {
        expect(shallowEquals({ a: 1, b: 2 }, { a: 1, b: 3 })).toBe(false);
        expect(shallowEquals({ a: 1, b: 2 }, { a: 1 })).toBe(false);
        expect(
            shallowEquals(
                { a: "hello", b: "world" },
                {
                    a: "hello",
                    b: "universe",
                }
            )
        ).toBe(false);
    });

    test("sets: equal shallow sets", () => {
        expect(shallowEquals(new Set([1, 2, 3]), new Set([1, 2, 3]))).toBe(true);
        expect(shallowEquals(new Set(["a", "b", "c"]), new Set(["a", "b", "c"]))).toBe(true);
        expect(shallowEquals(new Set([true, false]), new Set([true, false]))).toBe(true);
    });

    test("sets: unequal shallow sets", () => {
        expect(shallowEquals(new Set([1, 2, 3]), new Set([1, 2, 4]))).toBe(false);
        expect(shallowEquals(new Set(["a", "b", "c"]), new Set(["a", "b"]))).toBe(false);
        expect(shallowEquals(new Set([true, false]), new Set([false]))).toBe(false);
    });

    test("maps: equal shallow maps", () => {
        expect(
            shallowEquals(
                new Map([
                    ["a", 1],
                    ["b", 2],
                ]),
                new Map([
                    ["a", 1],
                    ["b", 2],
                ])
            )
        ).toBe(true);
        expect(
            shallowEquals(
                new Map([
                    [1, "hello"],
                    [2, "world"],
                ]),
                new Map([
                    [1, "hello"],
                    [2, "world"],
                ])
            )
        ).toBe(true);
        expect(
            shallowEquals(
                new Map<string, any>([
                    ["a", shallowEquals],
                    ["b", false],
                ]),
                new Map<string, any>([
                    ["a", shallowEquals],
                    ["b", false],
                ])
            )
        ).toBe(true);
    });

    test("maps: unequal shallow maps", () => {
        expect(
            shallowEquals(
                new Map([
                    ["a", 1],
                    ["b", 2],
                ]),
                new Map([
                    ["a", 1],
                    ["b", 3],
                ])
            )
        ).toBe(false);
        expect(
            shallowEquals(
                new Map([
                    ["a", 1],
                    ["b", 2],
                ]),
                new Map([["a", 1]])
            )
        ).toBe(false);
        expect(
            shallowEquals(
                new Map([
                    [1, "hello"],
                    [2, "world"],
                ]),
                new Map([
                    [1, "hello"],
                    [2, "universe"],
                ])
            )
        ).toBe(false);
    });

    test("different types", () => {
        // @ts-ignore
        expect(shallowEquals(42, "42")).toBe(false);
        // @ts-ignore
        expect(shallowEquals([1, 2, 3], { a: 1, b: 2, c: 3 })).toBe(false);
        // @ts-ignore
        expect(
            shallowEquals(
                new Set([1, 2, 3]),
                // @ts-ignore
                new Map([
                    ["a", 1],
                    ["b", 2],
                    ["c", 3],
                ])
            )
        ).toBe(false);
    });
});
