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

import { dateToDisplayString } from './date-utils';

export const formatDisplayTimestamp = (date?: number) => {
    if (date === undefined) {
        return formatDisplayText();
    }
    
    const minDate = new Date('1971');
    if (date < minDate.getTime()) {
        return formatDisplayDate(new Date(date * 1000));
    }

    return formatDisplayDate(new Date(date));
};

export const formatDisplayDate = (date?: Date) => {
    if (date === undefined) {
        return formatDisplayText();
    }

    return dateToDisplayString(date);
};

export const formatDisplayBoolean = (bool: any, defaultText = ['True', 'False']) => {
    return bool ? defaultText[0] : defaultText[1];
};

export const formatDisplayText = (text?: any, defaultText = '-') => {
    return text ? String(text) : defaultText;
};

export const formatDisplayNumber = (number: any) => {
    return isNaN(Number(number)) ? '-' : Number(number);
};

export const generateNameConstraintText = () => {
    return 'Maximum of 63 alphanumeric characters. Can include hyphens (-), but not spaces. Must be unique within your account in an AWS Region.';
};

export const deletionDescription = (entity: string) => {
    return `This will permanently delete your ${entity} and cannot be undone. This may affect other resources.`;
};
