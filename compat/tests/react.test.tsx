/**
 * @jest-environment jsdom
 */

import * as React from "react";
import { render } from "@testing-library/react";
import { computed, observable } from "onek";
import { useObserver } from "../src";

describe("useObserver", () => {
    it("returns wrapper function that returns result of thunk", async () => {
        const Component = () => {
            const observer = useObserver();

            return observer(() => <p>Hello!</p>);
        };

        const { findByText } = render(<Component />);

        const result = await findByText(/Hello!/i);

        expect(result).toBeTruthy();
    });

    it("re-renders component on observable changes", async () => {
        const [o1, seto1] = observable("Hello!");

        const Component = () => {
            const observer = useObserver();

            return observer(() => <p>{o1()}</p>);
        };

        const { findByText } = render(<Component />);

        const result = await findByText(/Hello!/i);

        seto1("Hola!");

        const result2 = await findByText(/Hola!/i);

        expect(result2).toBeTruthy();
    });

    it("re-renders component on computed changes", async () => {
        const [o1, seto1] = observable("Hello!");

        const c1 = computed(() => o1().toUpperCase());

        const Component = () => {
            const observer = useObserver();

            return observer(() => <p>{c1()}</p>);
        };

        const { findByText } = render(<Component />);

        const result = await findByText(/HELLO!/i);

        seto1("Hola!");

        const result2 = await findByText(/HOLA!/i);

        expect(result2).toBeTruthy();
    });
});
