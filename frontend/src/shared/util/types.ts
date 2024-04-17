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

/**
 * Defined a new type based on T but where keys are prefixed with Prefix. The first character of the key
 * will be capitalized before prefixing with Prefix.
 * 
 * @example
 * ```
 * type InputProps = {
 *   value: string,
 * };
 * 
 * type FieldProps = {
 *   name: string,
 * };
 * 
 * type InputAndFieldProps = PrefixedType<InputProps, 'input'> & PrefixedType<FieldProps, 'field'>;
 * 
 * const myInputProps: InputAndFieldProps = {
 *   inputValue: '...',
 *   fieldName: '...'
 * };
 * ```
 */
export type PrefixedType<T, Prefix extends string> = {
    [K in keyof T as `${Prefix}${Capitalize<string & K>}`]: T[K]
};

/**
 * Creates an object of type T from a {@link PrefixedType}.
 * 
 * @example
 * ```
  * type InputProps = {
 *   value: string,
 * };
 * 
 * type PrefixedInputProps = PrefixedType<InputProps, 'input'>;
 * const prefixedProps: PrefixedInputProps = {
 *   inputValue: '...',
 * };
 * 
 * const props: InputProps = extractPrefixedType(prefixedProps, 'input')
 * ```
 * 
 * @param object 
 * @param prefix 
 * @returns 
 */
export const extractPrefixedType = <PT extends PrefixedType<T, Prefix>, Prefix extends string, T extends object>(object: PT, prefix: Prefix): T => {
    return Object.fromEntries(
        Object.entries(object)
            .filter(([key]) => key.startsWith(String(prefix)))
            .map(([key, value]) => [`${key.charAt(String(prefix).length).toLowerCase()}${key.slice(String(prefix).length + 1)}`,value])
    ) as T;
};

/**
 * Defines a new type based on T but where keys K are optional.
 * 
 * @example
 * ```
 * type Sandwich = {
 *   meat: boolean,
 *   cheese: boolean,
 *   bread: string
 * };
 * 
 * const grilledCheese: Optional<Sandwich, 'meat'> = {
 *   cheese: true,
 *   bread: 'rye'
 * };
 * ```
 */
export type Optional<T, K extends keyof T> = Pick<Partial<T>, K> & Omit<T, K>;