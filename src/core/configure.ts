import { IOptions } from "./types";
import { setReactionExceptionHandler, setReactionScheduler } from "./schedulers";

export function configure(options: IOptions) {
    if (options.reactionScheduler) {
        setReactionScheduler(options.reactionScheduler);
    }
    if (options.reactionExceptionHandler) {
        setReactionExceptionHandler(options.reactionExceptionHandler);
    }
}
