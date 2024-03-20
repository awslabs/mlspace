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

import React, { useCallback, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { IHPOJob } from '../hpo-job.model';
import { TrainingJobDefinition } from './training-definitions/training-job-definition';
import { FormProps } from '../../form-props';
import { ModifyMethod } from '../../../../shared/validation/modify-method';
import { createTrainingDefinition } from '../../create.functions';
import _ from 'lodash';
import { useAppDispatch } from '../../../../config/store';
import { setBreadcrumbs } from '../../../../shared/layout/navigation/navigation.reducer';
import { HPOJobCreateState } from './hpo-job-create';
import { getBase } from '../../../../shared/util/breadcrumb-utils';

export type EditTrainingJobDefinitionProps = FormProps<IHPOJob>;
enum EditType {
    Add = 'Add',
    Edit = 'Edit',
}
export function EditTrainingJobDefinition (props: EditTrainingJobDefinitionProps) {
    const { item, setFields: setParentFields } = props;
    const { projectName, action } = useParams();
    const navigate = useNavigate();
    const dispatch = useAppDispatch();

    const editType = action === 'new' ? EditType.Add : EditType.Edit;

    // The useReducer init param function is only executed once and not on every render cycle
    const initializer = () => {
        return {
            form: getJobDefinition(),
            touched: {},
        };
    };

    useEffect(() => {
        dispatch(
            setBreadcrumbs([
                getBase(projectName),
                {
                    text: 'HPO Jobs',
                    href: `#/project/${projectName}/jobs/hpo`,
                },
                {
                    text: 'Create',
                    href: `#/project/${projectName}/jobs/hpo/create`,
                },
                {
                    text: `${editType} Training Job Definition`,
                    href: '',
                },
            ])
        );
    }, [dispatch, editType, projectName]);

    const getJobDefinition = useCallback(() => {
        if (editType === EditType.Edit) {
            return _.cloneDeep((item.TrainingJobDefinitions?.[Number(action)]));
        }

        return createTrainingDefinition();
    }, [action, editType, item.TrainingJobDefinitions]);

    const [state, setState] = React.useReducer(
        (state: HPOJobCreateState, action: { type: string; payload?: any }) => {
            switch (action.type) {
                case 'touchFields': {
                    const touched = state.touched;
                    action.payload.fields.forEach((path: string) => {
                        if (action.payload.method === ModifyMethod.Default) {
                            _.set(touched, path, true);
                        } else if (action.payload.method === ModifyMethod.Unset) {
                            _.unset(touched, path);
                        }
                    });

                    return {
                        ...state,
                        touched,
                    };
                }
                case 'setFields': {
                    const newState = { ...state };
                    Object.entries(action.payload.fields).forEach((entry) => {
                        const [key, value] = entry;
                        switch (action.payload.method) {
                            case ModifyMethod.Unset:
                                _.unset(newState, `form.${key}`);
                                break;
                            case ModifyMethod.Merge:
                                _.merge(_.get(newState, `form.${key}`), value);
                                break;
                            case ModifyMethod.Set:
                            default:
                                _.set(newState, `form.${key}`, value);
                        }
                    });

                    return newState;
                }
                case 'updateState':
                    return {
                        ..._.merge(state, action.payload),
                    };
            }

            return state;
        },
        null,
        initializer
    );

    useEffect(() => {
        setState({ type: 'updateState', payload: { form: getJobDefinition() } });
    }, [getJobDefinition]);

    const touchFields = (fields: string[], method = ModifyMethod.Default) => {
        setState({ type: 'touchFields', payload: { fields, method } });
    };
    const setFields = (fields: { [key: string]: any }, method = ModifyMethod.Default) => {
        setState({ type: 'setFields', payload: { fields, method } });
    };

    const onSubmit = () => {
        if (editType === EditType.Edit) {
            const jobDefinitions = [...item.TrainingJobDefinitions];
            jobDefinitions[Number(action)] = state.form;
            setParentFields({ TrainingJobDefinitions: jobDefinitions });
        } else {
            setParentFields({
                TrainingJobDefinitions: [...item.TrainingJobDefinitions, state.form],
            });
        }

        navigate(`/project/${projectName}/jobs/hpo/create`);
    };

    const onCancel = () => {
        navigate(`/project/${projectName}/jobs/hpo/create`);
    };

    return (
        <TrainingJobDefinition
            {...{ item: state.form, onSubmit, onCancel, setFields, touchFields }}
        />
    );
}