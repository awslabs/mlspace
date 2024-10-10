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
import { FormField, Grid, Input, TextContent, TextFilterProps } from '@cloudscape-design/components';
import { BaseKeyDetail, CancelableEventHandler } from '@cloudscape-design/components/internal/events';
import React, { useCallback, useEffect } from 'react';
import Condition from '../condition';
import { useDebounce } from '../../shared/util/hooks';

export type MLSTextFilterProps = TextFilterProps & {
    onKeyDown?: CancelableEventHandler<BaseKeyDetail>,
    requireEnter?: boolean,
    delay?: number
};

const KEYCODE_ENTER = 13;
const KEYCODE_ESC = 27;

export function MLSTextFilter (props: MLSTextFilterProps) {
    const { requireEnter = false, delay = 200, onKeyDown, onChange, onDelayedChange, filteringText } = props;

    const [state, setState] = React.useReducer((state, action: Partial<{dirty: boolean, filteringText: string}>) => {
        return {
            ...state,
            ...action
        };
    }, {
        dirty: false as boolean,
        filteringText: props.filteringText
    });

    useEffect(() => {
        setState({filteringText});
    }, [filteringText]);

    // memoize the callback with useCallback
    const memoizeOnDelayedChange = useCallback((event) => {
        onDelayedChange?.(event);
    }, [onDelayedChange]);

    // memoize the debounce call with useMemo
    const debouncedOnDelayedChange = useDebounce(memoizeOnDelayedChange, delay);

    let constraintText = '';
    if (requireEnter && state.dirty) {
        constraintText = `Press Enter to filter by prefix: "${state.filteringText}" or press ESC to clear.`;
    }

    return (
        <Grid gridDefinition={[{colspan: 6}]}>
            <>
                <FormField constraintText={constraintText} stretch={true}>
                    <Input
                        type='search'
                        data-cy={props.filteringAriaLabel}
                        value={state.filteringText}
                        placeholder={props.filteringPlaceholder}
                        clearAriaLabel={props.filteringClearAriaLabel}
                        disabled={props.disabled}
                        ariaLabel={props.filteringAriaLabel}
                        onChange={(event) => {
                            const isEmpty = !event.detail.value;
                            
                            if (requireEnter) {
                                setState({
                                    dirty: !isEmpty,
                                    filteringText: event.detail.value
                                });
                            }
                            
                            if (!requireEnter || isEmpty) {
                                onChange?.(new CustomEvent('change', {cancelable: false, detail: { filteringText: event.detail.value }}));
                                debouncedOnDelayedChange?.(event);
                            }
                        }}
                        onKeyDown={(event) => {
                            if (requireEnter) {
                                if (event.detail.keyCode === KEYCODE_ENTER && state.dirty) {
                                    onChange?.(new CustomEvent('change', {cancelable: false, detail: { filteringText: state.filteringText }}));
                                    setState({dirty: false});
                                } else if (event.detail.keyCode === KEYCODE_ESC) {
                                    onChange?.(new CustomEvent('change', {cancelable: false, detail: { filteringText: '' }}));
                                    setState({dirty: false, filteringText: ''});
                                    event.preventDefault();
                                    event.stopPropagation();
                                }
                            }
                            
                            onKeyDown?.(event);
                        }} />
                </FormField>
                <FormField>
                    <Condition condition={!!props.filteringText}>
                        <TextContent>
                            <p>
                                { props.countText }
                            </p>
                        </TextContent>
                    </Condition>
                </FormField>
            </>
        </Grid>
    );
}