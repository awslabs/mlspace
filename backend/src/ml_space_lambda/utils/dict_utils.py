#
#   Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
#
#   Licensed under the Apache License, Version 2.0 (the "License").
#   You may not use this file except in compliance with the License.
#   You may obtain a copy of the License at
#
#       http://www.apache.org/licenses/LICENSE-2.0
#
#   Unless required by applicable law or agreed to in writing, software
#   distributed under the License is distributed on an "AS IS" BASIS,
#   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#   See the License for the specific language governing permissions and
#   limitations under the License.
#


def filter_dict_by_keys(input: dict, allowed_keys: list[str]):
    """
    Returns a copy of input with keys not in allowed_keys removed

    Args:
        input (dict): A dict to filter
        allowed_keys (list[str]): A list of allowed keys

    Returns:
        dict: A copy of input with only keys specified in allowed_keys
    """
    return {key: input.get(key) for key in allowed_keys if input.get(key) is not None}


def map_dict_keys(input: dict, mapping: dict):
    """
    Returns a copy of input dict with the keys possible renamed using the
    provided mapping dict. Unspecified keys will be unchanged.

    Args:
        input (dict): A dict with keys to rename
        mapping (int): A dict of old key names to new key names

    Returns:
        dict: A copy of input with keys possibly renamed
    """
    return {mapping.get(key, key): input.get(key) for key in input}
