import { IOptions } from "./types";
import { setReactionExceptionHandler, setReactionScheduler } from "./schedulers";

export function configure(options: IOptions) {
    if (options.reactionScheduler) {
        /*@__INLINE__**/
        setReactionScheduler(options.reactionScheduler);
    }
    if (options.reactionExceptionHandler) {
        /*@__INLINE__**/
        setReactionExceptionHandler(options.reactionExceptionHandler);
    }
}
