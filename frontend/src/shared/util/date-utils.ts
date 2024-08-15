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
import { Timezone } from '../model/user.model';

export enum TimeUnit {
    SECONDS = 'seconds',
    MINUTES = 'minutes',
    HOURS = 'hours',
    DAYS = 'days',
}

/**
 * Convert duration in seconds to a display friendly duration in the largest valid unit. If a
 * duration value lasts between 0 and 60 minutes the duration will be returned in minutes, if it
 * lasts between 1 and 24 hours it will be returned as hours, and if it lasts > 24 hours it will be
 * returned in hours.
 *
 * @param durationInSeconds Total duration in seconds
 * @returns object with value and unit for the total duration
 */
export const getDuration = (durationInSeconds?: number) => {
    let duration = Number(durationInSeconds);
    let unit = TimeUnit.SECONDS;

    if (isNaN(duration)) {
        return {
            value: 0,
            unit,
        };
    }

    if (duration >= 60) {
        unit = TimeUnit.MINUTES;
        duration /= 60;
    }

    if (unit === TimeUnit.MINUTES && duration >= 60) {
        unit = TimeUnit.HOURS;
        duration /= 60;
    }

    if (unit === TimeUnit.HOURS && duration >= 24) {
        unit = TimeUnit.DAYS;
        duration /= 24;
    }

    return {
        value: Math.round(duration),
        unit,
    };
};

/**
 * Returns a Date object in the preferred timezone
 *
 * @returns A Date object with the current timezone information
 */
export const getDate = (): Date => {
    return new Date(dateToDisplayString(new Date()));
};

export const getPaddedNumberString = (number: number, padding: number): string => {
    return number.toString().padStart(padding, '0');
};

/**
 * Converts a value in seconds to a display friendly duration string rounded to the largest unit
 *
 * @param durationInSeconds elapsed time in seconds
 * @returns display friendly string of the duration
 */
export const formatDuration = (durationInSeconds?: number) => {
    const { value, unit } = getDuration(durationInSeconds);

    if (value === 0) {
        return '-';
    }

    switch (unit) {
        case TimeUnit.DAYS:
            return `${value} day(s)`;
        case TimeUnit.HOURS:
            return `${value} hour(s)`;
        case TimeUnit.MINUTES:
            return `${value} minute(s)`;
        case TimeUnit.SECONDS:
            return `${value} second(s)`;
        default:
            return '-';
    }
};

/**
 * Generate a display friendly duration string for the difference between two date strings.
 *
 * @param start start date time string
 * @param end end date time string
 * @returns difference between the two date time values expressed as a duration string
 */
export const formatDateDiff = (start: string, end: string) => {
    const startDate = new Date(start);
    const endDate = new Date(end);

    if (startDate.getTime() > endDate.getTime()) {
        return '-';
    }

    return formatDuration(Math.round((endDate.getTime() - startDate.getTime()) / 1000));
};

/**
 * Converts the specified date object to a UI friendly display string based on the users current
 * timezone preference (local time default).
 *
 * @param target date object to convert into display string
 * @returns display friendly string of date in the users preferred timezone
 */
export const dateToDisplayString = (target: Date) => {
    let timezone = Timezone.UTC.toString();
    try {
        const currentUser = JSON.parse(
            JSON.parse(localStorage.getItem('persist:mlspace')!).user
        ).currentUser;

        // Get the user preference and either get their local timezone, or use UTC. Default is local timezone,
        const timezonePreference = currentUser.preferences?.timezone || Timezone.LOCAL;
        timezone =
            timezonePreference === Timezone.LOCAL
                ? Intl.DateTimeFormat().resolvedOptions().timeZone
                : Timezone.UTC;
    } catch {
        // Just fallback to UTC
    }
    return target.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: 'numeric',
        second: 'numeric',
        timeZone: timezone,
        hour12: false,
        timeZoneName: 'short',
    });
};

/**
 * Converts a date string in the date time string format, YYYY-MM-DDTHH:mm:ss.sssZ, to a consistent
 * UI friendly display string in the users preferred timezone.
 *
 * @param dateString date time string to convert
 * @returns display friendly date time string
 */
export const formatDate = (dateString?: string) => {
    if (!dateString) {
        return '-';
    }

    try {
        return dateToDisplayString(new Date(Date.parse(dateString)));
    } catch (error) {
        return dateString;
    }
};

/**
 * Converts duration using a specified TimeUnit to seconds. For example a value of 3 and a unit of
 * HOURS will result in 3 * 60 * 60.
 *
 * @param value Amount of unit to convert
 * @param unit Unit of value to convert
 * @returns Total duration in seconds
 */
export const durationToSeconds = (value: number, unit: TimeUnit): number => {
    let maxRuntimeInSeconds = value;

    switch (unit) {
        case TimeUnit.SECONDS:
            maxRuntimeInSeconds = value;
            break;
        case TimeUnit.MINUTES:
            maxRuntimeInSeconds = Math.floor(value * 60);
            break;
        case TimeUnit.HOURS:
            maxRuntimeInSeconds = Math.floor(value * 60 * 60);
            break;
        case TimeUnit.DAYS:
            maxRuntimeInSeconds = Math.floor(value * 86400);
            break;
        default:
            maxRuntimeInSeconds = Math.floor(value * 60 * 60);
    }

    return maxRuntimeInSeconds;
};

/**
 * Convert from hours to days
 *
 * @param hours Total number of hours
 * @returns Number of days
 */
export const hoursToDays = (hours: number | undefined): number | undefined => {
    return hours && hours / 24;
};

/**
 * Converts an epochTime in the form of seconds since epoch to a UI friendly date time string
 * in the users preferred timezone.
 *
 * @param epochTime datetime in the form of seconds since epoch
 * @param timeOnly whether or not the display string should be only include the time (notebooks)
 * @param seconds whether or not the epoch time is in seconds (true) or milliseconds (false)
 * @returns display friendly string of date time in the users preferred timezone
 */
export const formatEpochTimestamp = (epochTime: number, timeOnly: boolean = false, seconds: boolean = true) => {
    const dateTime = seconds ? new Date(epochTime * 1000) : new Date(epochTime);
    if (timeOnly) {
        return dateTime.toLocaleTimeString('en-US', {
            timeZone: 'UTC',
            hour12: false,
            timeZoneName: 'short',
        });
    } else {
        return dateToDisplayString(dateTime);
    }
};

/**
 * Generate a display string for the timezone that a value is displayed in based on the
 * specified timezone preference (LOCAL or UTC)
 *
 * @param timezone Timezone preference
 * @returns Timezone abbreviation ie EST, CST, PST, etc
 */
export const timezoneDisplayString = (timezone = Timezone.LOCAL) => {
    return new Date()
        .toLocaleTimeString('en-us', {
            timeZone:
                timezone === Timezone.LOCAL
                    ? Intl.DateTimeFormat().resolvedOptions().timeZone
                    : Timezone.UTC,
            timeZoneName: 'short',
        })
        .split(' ')[2];
};

/**
 * Convert a HH:mm string from the specified sourceTimezone to the specified targetTimezone. For
 * example converting from a LOCAL timezone of EST to UTC would result in the hours value being +5
 *
 * @param stopTime HH:mm string to convert
 * @param sourceTimezone timezone that the stopTime is currently in (UTC is default)
 * @param targetTimezone timezone that the stopTime should be converted to (LOCAL is default)
 * @returns HH:mm string in the target timezone
 */
export const convertDailyStopTime = (
    stopTime?: string,
    sourceTimezone = Timezone.UTC,
    targetTimezone = Timezone.LOCAL
) => {
    if (!stopTime) {
        return undefined;
    }
    // Nothing to convert
    if (sourceTimezone === targetTimezone) {
        return stopTime;
    } else if (targetTimezone === Timezone.LOCAL) {
        // If we're converting to LOCAL that means the current stop time is in UTC
        const utcHour = Number(stopTime.split(':')[0]);
        const utcMin = Number(stopTime.split(':')[1]);
        const result = new Date();
        result.setUTCHours(utcHour);
        result.setUTCMinutes(utcMin);
        return `${result.getHours()}:${result.getMinutes().toString().padStart(2, '0')}`;
    } else {
        // If we're converting to UTC that means the current stop time is in LOCAL
        const localHour = Number(stopTime.split(':')[0]);
        const localMin = Number(stopTime.split(':')[1]);
        const result = new Date();
        result.setHours(localHour);
        result.setMinutes(localMin);
        return `${result.getUTCHours()}:${result.getUTCMinutes().toString().padStart(2, '0')}`;
    }
};

export const timeInSeconds = function (days = 0, hours = 0, minutes = 0, seconds = 0): number {
    return days * 86400 + hours * 3600 + minutes * 60 + seconds;
};
