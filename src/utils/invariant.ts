/*#__PURE__*/
export function invariant(condition: any, message: string) {
    if (process.env.NODE_ENV !== "production") {
        if (!condition) {
            throw new Error(message);
        }
    }
}
