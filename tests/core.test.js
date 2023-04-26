const {
    observable,
    computed: _computed,
    reaction: _reaction,
    tx,
    utx,
    action,
    configure,
} = require("../packages/onek/src/core");

const updatesMap = new WeakMap();

const updates = (val) => updatesMap.get(val) ?? updatesMap.get(val.track) ?? 0;

const trackUpdate = (val) => updatesMap.set(val, updates(val) + 1);

const computed = (fn, checkFn) => {
    const comp = _computed(() => {
        trackUpdate(comp);
        return fn();
    }, checkFn);

    return comp;
};

const reaction = (fn, manager) => {
    const t = {};
    const r = _reaction(() => {
        trackUpdate(t);
        return fn();
    }, manager);

    r.track = t;

    return r;
};

const getCheck = () => {
    const check = (a, b) => {
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
        const check = (a, b) => {
            trackUpdate(check);
            return a === b;
        };

        const [o1, seto1] = observable(1, check);

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

    it("updates value with updater fn", () => {
        const [o1, seto1] = observable(1);

        seto1((value) => value + 1);

        expect(o1()).toBe(2);
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
    });

    it("throws when has recursive dependencies", () => {
        const c1 = computed(() => {
            return c1() * 2;
        });

        expect(() => {
            c1();
        }).toThrow();
    });

    it("throws when has recursive dependencies", () => {
        const c1 = computed(() => {
            return c2() * 2;
        });

        const c2 = computed(() => {
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

    describe("passive computed", () => {});
});

describe("reaction", () => {
    it("reacts to observable changes", () => {
        const [o1, seto1] = observable(1);

        let r1;

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

        r1();
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
        let _args;

        const a1 = action((...args) => {
            _args = args;
            return "hello";
        });

        expect(a1(1, "world")).toBe("hello");
        expect(_args).toStrictEqual([1, "world"]);
    });

    it("applies this", () => {
        let _this;

        const obj = {
            a: action(function () {
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
            const custom = (runner) => {
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
            const microtask = (runner) => {
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

            // does not run syncronously
            expect(updates(r1)).toBe(1);
            expect(updates(microtask)).toBe(1);

            await Promise.resolve();

            expect(updates(r1)).toBe(2);
            expect(updates(microtask)).toBe(1);

            configure({ reactionScheduler: (runner) => runner() });
        });
    });
});
