import { withUntracked } from "../transaction";

const hasOwnProperty = Object.prototype.hasOwnProperty;

function isPlainObject(obj: any): obj is Object {
    return obj.constructor === Object || obj.constructor === null;
}

export function shallowEquals<T>(prev: T, next: T): boolean {
    if (prev === next) {
        return true;
    }

    if (Array.isArray(prev) && Array.isArray(next)) {
        let idx = prev.length;

        if (idx !== next.length) {
            return false;
        }

        while (idx--) {
            if (prev[idx] !== next[idx]) {
                return false;
            }
        }

        return true;
    }

    if (
        prev &&
        next &&
        typeof prev === "object" &&
        typeof next === "object" &&
        isPlainObject(prev) &&
        isPlainObject(next)
    ) {
        const prevKeys = Object.keys(prev);

        let index = prevKeys.length;

        if (Object.keys(next).length !== index) {
            return false;
        }

        while (index-- > 0) {
            let key = prevKeys[index];

            // @ts-ignore
            if (!hasOwnProperty.call(next, key) || prev[key] !== next[key]) {
                return false;
            }
        }

        return true;
    }

    if (prev instanceof Set && next instanceof Set) {
        if (prev.size !== next.size) {
            return false;
        }

        let result = true;

        prev.forEach((value) => {
            if (!next.has(value)) {
                result = false;
            }
        });

        return result;
    }

    if (prev instanceof Map && next instanceof Map) {
        if (prev.size !== next.size) {
            return false;
        }

        let result = true;

        prev.forEach((value, key) => {
            if (next.get(key) !== value) {
                result = false;
            }
        });

        return result;
    }

    return false;
}

export const untrackedShallowEquals = withUntracked(shallowEquals);
