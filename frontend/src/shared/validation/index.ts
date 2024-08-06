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
import z from 'zod';
import _ from 'lodash';
import { ModifyMethod } from './modify-method';
import React, { useReducer } from 'react';

/**
 * Scrolls to the first element with `[aria-invalid=true]` attribute
 */
export function scrollToInvalid () {
    setTimeout(() => {
        window.requestAnimationFrame(() => {
            document.querySelector('[aria-invalid=true]:not([disabled]')?.scrollIntoView();
            const firstFieldInError = document.querySelector('[aria-invalid=true]:not([disabled]');
            if (firstFieldInError) {
                if (firstFieldInError instanceof HTMLElement) {
                    firstFieldInError.focus();
                }
                firstFieldInError.scrollIntoView();
            }
        });
    }, 10);
}

/**
 * Function to convert an array of {@link z.ZodIssue}s to an object tree using their
 * path components as a keypath to the error messages. If {@link touched} is provided
 * than only issues that have a corresponding value set at that keypath on {@link touched}
 * will be included in the returned object tree.
 *
 * @example
 * Returns `{example1: 'error1'}
 *
 * ```ts
 * const issues = [{message: 'error1', path: ['example1']}, {message: 'error2': path: ['example2']}];
 * const touched = {example1: true};
 * const errors = issuesToErrors(issues, touched)
 * console.log(errors)
 * ```
 *
 * @param issues an array of {@link z.ZodIssue}s
 * @param touched (optional) an object tree for what keypaths to include in the output
 * @returns an object tree with error messages at keypaths corresponding to {@link z.ZodIssue} path components
 */
export function issuesToErrors (issues: z.ZodIssue[], touched?: any): any {
    const formErrors = {} as any;
    issues.forEach((issue) => {
        const key = issue.path.reduce((previous, current) => {
            if (isNaN(Number(current))) {
                return `${previous}.${current}`;
            } else {
                return `${previous}[${current}]`;
            }
        });

        if (touched === undefined || _.get(touched, key) !== undefined) {
            const existing = _.get(formErrors, key);

            if (existing === undefined) {
                _.set(formErrors, key, issue.message);
            } else {
                _.set(formErrors, key, `${existing}; ${issue.message}`);
            }
        }
    });

    return formErrors;
}

/**
 * Removes a property or element from target at {@link path} on {@link target}
 *
 * @param path the keypath to the property or element to remove
 * @param target the top level object to traverse to find the property/element to remove
 * @param prefix an optional prefix that should be applied to the {@link path}
 */
function unsetItem<T> (path: string, target: T, prefix?: string) {
    const prefixer = (path: string, prefix?: string) => {
        return (prefix ? [prefix, path] : [path]).join('.');
    };

    const match = path.match(/(.+)\[(\d)\]$/);
    if (match) {
        const prefixPath = match[1];
        const index = Number(match[2]);
        const itemArray = _.get(target, prefixer(prefixPath, prefix));
        if (itemArray instanceof Array) {
            itemArray.splice(index, 1);
        }
    } else {
        _.unset(target, prefixer(path, prefix));
    }
}

export type SetFieldsFunction = (
    values: { [key: string]: any },
    method?: ValidationFormActionMethod
) => void;

/**
 * Wraps a {@link SetFieldsFunction} with a prefix
 *
 * @param prefix the prefix to use
 * @param setFields the original setFields method
 * @returns the wrapped setFields method
 */
export const prefixedSetFields = (
    prefix: string,
    setFields: SetFieldsFunction
): SetFieldsFunction => {
    return (values: { [key: string]: any }, method?: ValidationFormActionMethod) => {
        const keyValues = Object.keys(values).map((key) => {
            return { [`${prefix}.${key}`]: values[key] };
        });

        setFields(Object.assign({}, ...keyValues), method);
    };
};

export type TouchFieldsFunction = (fields: string[], method?: ValidationTouchActionMethod) => void;

/**
 * Wraps a {@link TouchFieldsFunction} method with a prefix.
 *
 * @param prefix the prefix to use
 * @param touchFields the original touchFields method
 * @returns the wrapped touchFields method
 */
export const prefixedTouchFields = (
    prefix: string,
    touchFields: TouchFieldsFunction
): TouchFieldsFunction => {
    return (fields: string[], method?: ValidationTouchActionMethod) => {
        touchFields(
            fields.map((key) => `${prefix}.${key}`),
            method
        );
    };
};

/**
 * Union of acceptable {@link ModifyMethod}s for ValidationTouchAction
 */
export type ValidationTouchActionMethod =
    | ModifyMethod.Unset
    | ModifyMethod.Set
    | ModifyMethod.Default;

/**
 * Action for modifying touched fields
 */
export type ValidationTouchAction = {
    type: ValidationReducerActionTypes.TOUCH;
    method: ValidationTouchActionMethod;
    fields: string[];
};

/**
 * Union of acceptable {@link ModifyMethod}s for ValidationFormAction
 */
export type ValidationFormActionMethod = ModifyMethod;

/**
 * Action for modifying form fields
 */
export type ValidationFormAction = {
    type: ValidationReducerActionTypes.FORM;
    method: ModifyMethod;
    fields: { [key: string]: any };
};

/**
 * Union of acceptable {@link ModifyMethod}s for ValidationStateAction
 */
export type ValidationStateActionMethod =
    | ModifyMethod.Set
    | ModifyMethod.Merge
    | ModifyMethod.Default;

/**
 * Action for modifying state fields
 */
export type ValidationStateAction = {
    type: ValidationReducerActionTypes.STATE;
    method: ValidationStateActionMethod;
    newState: any;
};

/**
 * Action types accepted by the reducer created by {@link validationReducer}
 */
export enum ValidationReducerActionTypes {
    TOUCH = 'touchAction',
    FORM = 'formAction',
    STATE = 'stateAction',
}

/**
 * Actions accepted by the reducer created by {@link validationReducer}
 */
export type ValidationReducerAction =
    | ValidationTouchAction
    | ValidationFormAction
    | ValidationStateAction;

export type ValidationReducerBaseState<F> = {
    validateAll: boolean;
    touched: any;
    formSubmitting: boolean;
    form: F;
};

/**
 * Response object created by {@link validationReducer}
 */
export type ValidationReducerResponse<S> = {
    state: S;
    setState(newState: Partial<S>, method?: ModifyMethod): void;
    errors: any;
    isValid: boolean,
    setFields: SetFieldsFunction;
    touchFields: TouchFieldsFunction;
};

export const useValidationReducer = <F, S extends ValidationReducerBaseState<F>>(
    formSchema: any,
    initialState: S
): ValidationReducerResponse<S & ValidationReducerBaseState<F>> => {
    const [state, setState] = React.useReducer((state: S, action: ValidationReducerAction) => {
        // perform a deep copy of the state so this reducer is considered a "pure" reducer with no side effects
        // otherwise ModifyMethod.Unset can splice the wrong index if this reducer is called multiple times (which is expected behavior with React.StrictMode)
        const newState = _.cloneDeep(state);

        switch (action.type) {
            case ValidationReducerActionTypes.TOUCH:
                {
                    const touched = newState.touched;
                    action.fields.forEach((path: string) => {
                        switch (action.method) {
                            case ModifyMethod.Unset:
                                unsetItem(path, touched);
                                break;
                            case ModifyMethod.Set:
                            default:
                                _.set(touched, path, true);
                        }
                    });

                    newState.touched = touched;
                }
                break;
            case ValidationReducerActionTypes.FORM:
                Object.entries(action.fields).forEach((entry) => {
                    const [keypath, value] = entry;

                    switch (action.method) {
                        case ModifyMethod.Unset:
                            unsetItem(keypath, newState, 'form');
                            break;
                        case ModifyMethod.Merge:
                            _.merge(_.get(newState, `form.${keypath}`), value);
                            break;
                        case ModifyMethod.Set:
                        default:
                            _.set(newState, `form.${keypath}`, value);
                    }
                });
                break;
            case ValidationReducerActionTypes.STATE:
                switch (action.method) {
                    case ModifyMethod.Set:
                        return action.newState;
                    case ModifyMethod.Merge:
                    default:
                        _.merge(newState, action.newState);
                }
        }

        return newState;
    }, initialState);

    let errors = {} as any;
    const parseResult = formSchema.safeParse(state.form);
    if (!parseResult.success) {
        errors = issuesToErrors(
            parseResult.error.issues,
            state.validateAll === true ? undefined : state.touched
        );
    }

    return {
        state,
        errors,
        isValid: parseResult.success,
        setState: (newState: Partial<S>, method: ValidationStateActionMethod = ModifyMethod.Default) => {
            setState({
                type: ValidationReducerActionTypes.STATE,
                method,
                newState,
            } as ValidationStateAction);
        },
        setFields: (
            fields: { [key: string]: any },
            method: ValidationFormActionMethod = ModifyMethod.Default
        ) => {
            setState({
                type: ValidationReducerActionTypes.FORM,
                method,
                fields,
            } as ValidationFormAction);
        },
        touchFields: (
            fields: string[],
            method: ValidationTouchActionMethod = ModifyMethod.Default
        ) => {
            setState({
                type: ValidationReducerActionTypes.TOUCH,
                method,
                fields,
            } as ValidationTouchAction);
        },
    };
};

/**
 * @deprecated future forms should look to use {@link useValidationReducer}
 */
export const useValidationState = (formSchema: any, initializerArg: object) => {
    const [state, setState] = useReducer((state: any, action: { type: string; payload?: any }) => {
        switch (action.type) {
            case 'validateAll':
                return { ...state, validateAll: true, needsValidation: true };
            case 'updateValidation':
                return {
                    ...state,
                    formErrors: action.payload.formErrors,
                    formValid: action.payload.formValid,
                    needsValidation: false,
                };
            case 'updateForm':
                return {
                    ...state,
                    form: { ..._.merge({}, state.form, action.payload) },
                    needsValidation: true,
                };
            case 'updateList':
                // Only use this for a top level merge of two lists where the new list should overwrite the old one
                return {
                    ...state,
                    form: {...state.form, ...action.payload},
                    needsValidation: true,
                };
            case 'updateEnvironment':
                return {
                    ...state,
                    form: { ...state.form, Environment: action.payload.Environment },
                    needsValidation: true,
                };
            case 'touchField':
                return {
                    ...state,
                    touched: _.set(state.touched, action.payload, true),
                    needsValidation: true,
                };
            case 'updateState':
                return _.merge({}, state, action.payload);
        }

        return state;
    }, initializerArg);

    // actions
    const updateForm = (payload: any) => setState({ type: 'updateForm', payload });
    const updateList = (payload: any) => setState({ type: 'updateList', payload });
    const touchField = (payload: string) => setState({ type: 'touchField', payload });
    const updateEnvironment = (payload: any) => setState({ type: 'updateEnvironment', payload });

    // create a event handler for touching a field
    const touchFieldHandler = (fieldName: string) => {
        return () => {
            touchField(fieldName);
        };
    };

    if (state.needsValidation) {
        const parseResult = formSchema.safeParse(state.form);

        if (parseResult.success) {
            setState({ type: 'updateValidation', payload: { formErrors: {}, formValid: true } });
        } else {
            const formErrors = issuesToErrors(
                parseResult.error.issues,
                state.validateAll === true ? undefined : state.touched
            );
            setState({ type: 'updateValidation', payload: { formErrors, formValid: false } });
        }
    }

    return {
        updateForm,
        updateList,
        touchFieldHandler,
        updateEnvironment,
        state,
        setState,
    };
};

export const duplicateAttributeRefinement = (keyField: string) => {
    return (attributes, ctx) => {
        attributes.forEach((originalVariable: any, originalIndex) => {
            attributes.slice(originalIndex + 1).forEach((attribute: any, index) => {
                if (originalVariable[keyField] === attribute[keyField]) {
                    ctx.addIssue({
                        code: 'custom',
                        message: `Duplicate ${keyField}`,
                        path: [originalIndex + 1 + index, keyField],
                    });
                }
            });
        });
    };
};
