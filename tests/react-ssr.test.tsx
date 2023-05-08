/**
 * @jest-environment node
 */

import * as React from "react";
import { renderToString } from "react-dom/server";
import { observable, useObserver } from "../src";

describe("non-browser environment", () => {
    it("returns noop wrapper", () => {
        const [o1, seto1] = observable("Hello!");

        const Component = () => {
            const observer = useObserver();

            return observer(() => <p>{o1()}</p>);
        };

        const result = renderToString(<Component />);

        expect(result).toBe("<p>Hello!</p>");
    });

    it("returns noop wrapper", () => {
        const [o1, seto1] = observable("Hello!");

        const Component = () => {
            const observer = useObserver();

            return <p>{o1(observer)}</p>;
        };

        const result = renderToString(<Component />);

        expect(result).toBe("<p>Hello!</p>");
    });
});
