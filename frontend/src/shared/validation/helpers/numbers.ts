/**
  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.

  Licensed under the Apache License, Version 2.0 (the "License").
  You may not use this file except in compliance with the License.
  You may obtain a copy of the License at

      http://www.apache.org/licenses/LICENSE-2.0

  Unless required by applicable law or agreed to in writing, software
  distributed under the License is distributed on an "AS IS" BASIS,
  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
  See the License for the specific language governing permissions and
  limitations under the License.
*/

import { z } from 'zod';

/**
 * Represents the properties of a numeric interval
 */
export enum IntervalStrategy {
    OPEN,
    CLOSED,
    LEFT_OPEN,
    RIGHT_OPEN,
}

/**
 * Creates a validator for a numeric interval
 *
 * @param bounds an array containing the lower and upper bounds of an interval
 * @param strategy the strategy used for the upper and lower bounds
 * @param isInteger if the interval is constrained to integers
 * @returns a validator for a numeric interval
 */
export const numberIntervalValidator = (bounds: [number, number], strategy: IntervalStrategy = IntervalStrategy.RIGHT_OPEN, isInteger: boolean) => {
    let validator = z.coerce.number({
        invalid_type_error: `Must be ${isInteger ? 'an integer' : 'a float'}`
    });

    if (isInteger) {
        validator = validator.int();
    }

    if ([IntervalStrategy.CLOSED, IntervalStrategy.RIGHT_OPEN].indexOf(strategy) !== -1) {
        validator = validator.gte(bounds[0]);
    } else {
        validator = validator.gt(bounds[0]);
    }

    if ([IntervalStrategy.CLOSED, IntervalStrategy.LEFT_OPEN].indexOf(strategy) !== -1) {
        validator = validator.lte(bounds[1]);
    } else {
        validator = validator.lt(bounds[1]);
    }

    return validator;
};

/**
 * Creates a validator for floats within a numeric interval
 *
 * @param bounds an array containing the lower and upper bounds of an interval
 * @param strategy the strategy used for the upper and lower bounds
 * @returns a validator for integers within a numeric interval
 */
export const floatIntervalValidator = (bounds: [number, number], strategy: IntervalStrategy = IntervalStrategy.RIGHT_OPEN) => {
    return numberIntervalValidator(bounds, strategy, false);
};

/**
 * Creates a validator for integers within a numeric interval
 *
 * @param bounds an array containing the lower and upper bounds of an interval
 * @param strategy the strategy used for the upper and lower bounds
 * @returns a validator for floats within a numeric interval
 */
export const integerIntervalValidator = (bounds: [number, number], strategy: IntervalStrategy = IntervalStrategy.RIGHT_OPEN) => {
    return numberIntervalValidator(bounds, strategy, true);
};

