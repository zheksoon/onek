import {
    action,
    CheckFn,
    computed as _computed,
    Computed,
    configure,
    Disposer,
    IComputedGetter,
    observable,
    Observable,
    reaction as _reaction,
    Reaction,
    tx,
    untracked,
    utx,
} from "../src";
import { ReactionFn } from "../src/core";

const updatesMap = new WeakMap<any, number>();

const updates = (val: any) => updatesMap.get(val) ?? updatesMap.get(val.track) ?? 0;

const trackUpdate = (val: any) => {
    updatesMap.set(val, updates(val) + 1);
};

const computed = <T>(fn: () => T, checkFn?: boolean | CheckFn<T>) => {
    const comp = _computed(() => {
        trackUpdate(comp);
        return fn();
    }, checkFn);

    return comp;
};

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
        const [o1, seto1] = observable<number>(1, true);

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
        const box = observable.box(1, true);

        expect(box).toBeInstanceOf(Observable);
    });

    it("observable.prop return instance of Observable ignoring type", () => {
        const box = observable.prop(1, true);

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

        const c1 = computed(() => o1());

        expect(c1()).toBe(5);
        expect(updates(c1)).toBe(1);

        seto1(10);

        expect(c1()).toBe(10);
        expect(updates(c1)).toBe(2);

        seto1(10);

        expect(c1()).toBe(10);
        expect(updates(c1)).toBe(3);
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

            const c1 = computed(() => o1() * 2, true);

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
            expect(updates(c1)).toBe(2);
            expect(updates(c2)).toBe(2);
            expect(updates(r1)).toBe(1);

            seto1(1); // new value
            expect(updates(c1)).toBe(3);
            expect(updates(c2)).toBe(3);
            expect(updates(r1)).toBe(2);

            seto1(1); // same value after new value
            expect(updates(c1)).toBe(4);
            expect(updates(c2)).toBe(4);
            expect(updates(r1)).toBe(2);
        });

        it("chain o -> c -> v -> c -> r", () => {
            const check2 = getCheck();

            const [o1, seto1] = observable(0);
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

            seto1(0); // same value
            expect(updates(c1)).toBe(2);
            expect(updates(c2)).toBe(2);
            expect(updates(c3)).toBe(1);
            expect(updates(r1)).toBe(1);

            seto1(1); // new value
            expect(updates(c1)).toBe(3);
            expect(updates(c2)).toBe(3);
            expect(updates(c3)).toBe(2);
            expect(updates(r1)).toBe(2);

            seto1(1); // same value after new value
            expect(updates(c1)).toBe(4);
            expect(updates(c2)).toBe(4);
            expect(updates(c3)).toBe(2);
            expect(updates(r1)).toBe(2);
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

            expect(updates(c1)).toBe(2);
            expect(updates(c2)).toBe(1);
            expect(updates(r1)).toBe(1);

            seto1(1);

            expect(updates(c1)).toBe(3);
            expect(updates(c2)).toBe(2);
            expect(updates(r1)).toBe(2);

            seto1(1);

            expect(updates(c1)).toBe(4);
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

            seto1(3);

            expect(c2()).toBe(1);
            expect(updates(c1)).toBe(4);
            expect(updates(c2)).toBe(3);
            expect(updates(r1)).toBe(2);

            seto1(1);

            expect(c2()).toBe(1);
            expect(updates(c1)).toBe(5);
            expect(updates(c2)).toBe(4);
            expect(updates(r1)).toBe(2);
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

            expect(updates(c1)).toBe(2);
            expect(updates(c2)).toBe(1);
            expect(updates(r1)).toBe(1);

            seto2(2);

            expect(updates(c1)).toBe(2);
            expect(updates(c1)).toBe(2);
            expect(updates(c1)).toBe(2);

            seto1(1);

            expect(updates(c1)).toBe(3);
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

            expect(updates(c1)).toBe(2);
            expect(updates(c2)).toBe(2);
            expect(updates(r1)).toBe(1);

            seto1(1);

            expect(updates(c1)).toBe(3);
            expect(updates(c2)).toBe(3);
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

            expect(updates(c1)).toBe(2);
            expect(updates(c2)).toBe(2);
            expect(updates(r1)).toBe(1);
        });

        it("multiple sources", () => {
            const [o1, seto1] = observable(1);
            const [o2, seto2] = observable(2);

            const c1 = computed(() => o1() * 2, true);
            const c2 = computed(() => o2() * 2, true);

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
        if (!global.gc) {
            return;
        }

        it("passive computed is garbage collected when not referenced", async () => {
            const [o1, seto1] = observable(0);

            let c1: IComputedGetter<number> | null = computed(() => o1() * 2);

            // @ts-ignore
            const weakRef = new WeakRef(c1);

            // Set up the FinalizationRegistry
            // @ts-ignore
            const registry = new FinalizationRegistry((resolve: () => void) => {
                // This callback will be called when the object is garbage-collected
                resolve();
            });

            // Create a promise and register the object with the resolve function
            const gcPromise = new Promise<void>((resolve) => {
                registry.register(c1!, resolve);
            });

            c1();

            // Release the strong reference to the object
            c1 = null;

            // Run garbage collection if it's available
            for (let i = 0; i < 10; i++) {
                global.gc?.();
                await new Promise((r) => setTimeout(r, 50));
            }

            // Wait for the FinalizationRegistry callback to be called
            await gcPromise;

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
        const c1 = _computed.box(() => 1, true);

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

        expect(updates(r1)).toBe(3);

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

        expect(updates(c1)).toBe(3);
        expect(updates(r1)).toBe(3);

        r1.run();

        expect(updates(c1)).toBe(3);
        expect(updates(r1)).toBe(4);

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

    it("unsubscribe and subscribe work as expected", () => {
        const [o1, seto1] = observable(1);

        const r1 = new Reaction(() => {
            trackUpdate(r1);
            o1();
        });

        r1.run();

        expect(updates(r1)).toBe(1);

        seto1(2);

        expect(updates(r1)).toBe(2);

        r1.unsubscribe();

        seto1(3);

        expect(updates(r1)).toBe(2);

        r1.subscribe();

        seto1(4);

        expect(updates(r1)).toBe(3);

        r1.destroy();
    });

    it("missedRun works is true when subscriptions are changed when reaction is unsubscribed", () => {
        const [o1, seto1] = observable(1);

        const r1 = new Reaction(() => {
            trackUpdate(r1);
            o1();
        });

        r1.run();

        expect(updates(r1)).toBe(1);

        seto1(2);

        expect(updates(r1)).toBe(2);
        expect(r1.missedRun()).toBe(false);

        r1.unsubscribe();

        seto1(3);

        expect(updates(r1)).toBe(2);
        expect(r1.missedRun()).toBe(true);
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
    describe("reactionRunner", () => {
        it("sets custom reaction runner", () => {
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

        it("microtask runner works as expected", async () => {
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
});
