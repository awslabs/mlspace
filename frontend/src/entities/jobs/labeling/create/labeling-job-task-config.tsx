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

import React from 'react';

import TaskTypeImageClassification from '../../../../content/images/console/groundtruth/tasktype-image-classification.png';
import TaskTypeImageClassificationMulti from '../../../../content/images/console/groundtruth/tasktype-image-classification-multilabel.png';
import TaskTypeImageBoundingBox from '../../../../content/images/console/groundtruth/tasktype-bounding-box.png';
import TaskTypeImageSemanticSegmentation from '../../../../content/images/console/groundtruth/tasktype-semantic-segmentation.png';
import TaskTypeImageLabelVerification from '../../../../content/images/console/groundtruth/tasktype-label-verification.png';
import TaskTypeTextClassification from '../../../../content/images/console/groundtruth/tasktype-text-classification.png';
import TaskTypeTextClassificationMulti from '../../../../content/images/console/groundtruth/tasktype-text-classification-multilabel.png';
import TaskTypeTextEntityRecognition from '../../../../content/images/console/groundtruth/tasktype-named-entity-recognition.png';
import QuickInstructionsExamplePlaceholder from '../../../../content/images/console/groundtruth/quick-instructions-example-placeholder.png';
import { LabelingJobCategory } from '../labeling-job.model';
import { LabelingJobTypes } from '../labeling-job.common';

export type TaskTypeConfig = {
    enabled: boolean;
    label: string;
    description: string;
    maxLabelCount: number;
    minLabelCount: number;
    value: LabelingJobTypes;
    image: React.ReactElement;
    shortInstruction: string;
    fullInstruction: string;
    keywords: string[];
    autoLabeling: boolean;
};

/* TASK_TYPE_CONFIG is a mapping for labeling job task types to metadata used to populate the create form.
    The instructions provided within are default and can be found in the SageMaker documentation
    https://docs.aws.amazon.com/sagemaker/latest/dg/sms-creating-instruction-pages.html */
export const TASK_TYPE_CONFIG: {
    [key in LabelingJobCategory]: { [key in LabelingJobTypes]: TaskTypeConfig };
} = {
    Image: {
        ImageMultiClass: {
            enabled: true,
            label: 'Image Classification (Single Label)',
            maxLabelCount: 30,
            minLabelCount: 2,
            description: 'Get workers to categorize images into individual classes.',
            value: LabelingJobTypes.ImageMultiClass,
            image: (
                <img
                    src={TaskTypeImageClassification}
                    alt='Basketball game with radio button selection of basketball, selected, and soccer, not selected.'
                />
            ),
            shortInstruction: `
                <h3><span style="color: rgb(0, 138, 0);">Good example</span></h3>
                <p>Enter description to explain the correct label to the workers</p>
                <p><img src="${QuickInstructionsExamplePlaceholder}" style="max-width:100%" alt="Add image here"></p>
                <h3><span style="color: rgb(230, 0, 0);">Bad example</span></h3>
                <p>Enter description of an incorrect label</p>
                <p><img src="${QuickInstructionsExamplePlaceholder}" style="max-width:100%" alt="Add image here"></p>`,
            fullInstruction: `
                <ol>
                    <li><strong>Read</strong> the task carefully and inspect the image.</li>
                    <li><strong>Read</strong> the options and review the examples provided to understand more about the labels.</li>
                    <li><strong>Choose</strong> the appropriate labels that best suit the image.</li>
                </ol>`,
            keywords: ['Images', 'categorization', 'classification'],
            autoLabeling: true,
        },
        ImageMultiClassMultiLabel: {
            enabled: true,
            label: 'Image Classification (Multi-label)',
            maxLabelCount: 50,
            minLabelCount: 2,
            description: 'Get workers to categorize images into one or more classes.',
            value: LabelingJobTypes.ImageMultiClassMultiLabel,
            image: (
                <img
                    src={TaskTypeImageClassificationMulti}
                    alt='Roadway with pedestrian and check boxes of human, selected, vehicle, selected, and animal, not selected.'
                />
            ),
            shortInstruction: `
                <h3><span style="color: rgb(0, 138, 0);">Good example</span></h3>
                <p>Enter description to explain the correct label to the workers</p>
                <p><img src="${QuickInstructionsExamplePlaceholder}" style="max-width:100%" alt="Add image here"></p>
                <h3><span style="color: rgb(230, 0, 0);">Bad example</span></h3>
                <p>Enter description of an incorrect label</p>
                <p><img src="${QuickInstructionsExamplePlaceholder}" style="max-width:100%" alt="Add image here"></p>`,
            fullInstruction: `
                <ol>
                    <li><strong>Read</strong> the task carefully and inspect the image.</li>
                    <li><strong>Read</strong> the options and review the examples provided to understand more about the labels.</li>
                    <li><strong>Choose</strong> the appropriate labels that best suit the image.</li>
                </ol>`,
            keywords: ['Images', 'categorization', 'classification'],
            autoLabeling: false,
        },
        BoundingBox: {
            enabled: true,
            label: 'Bounding box',
            maxLabelCount: 50,
            minLabelCount: 1,
            description:
                'Get workers to draw bounding boxes around specified objects in your images.',
            value: LabelingJobTypes.BoundingBox,
            image: (
                <img
                    src={TaskTypeImageBoundingBox}
                    alt='Two birds chirping at one another where birds are marked with boxes.'
                />
            ),
            shortInstruction: `
                <h3><span style="color: rgb(0, 138, 0);">Good example</span></h3><p>Enter description of a correct bounding box label</p><p><img src="${QuickInstructionsExamplePlaceholder}" style="max-width:100%" alt="Add image here"></p>
                <h3><span style="color: rgb(230, 0, 0);">Bad example</span></h3><p>Enter description of an incorrect bounding box label</p><p><img src="${QuickInstructionsExamplePlaceholder}" style="max-width:100%" alt="Add image here"></p>`,
            fullInstruction: `
                <ol>
                    <li><strong>Inspect</strong> the image</li>
                    <li><strong>Determine</strong> if the specified label is/are visible in the picture.</li>
                    <li><strong>Outline</strong> each instance of the specified label in the image using the provided “Box” tool.</li>
                </ol>
                <ul>
                    <li>Boxes should fit tight around each object</li>
                    <li>Do not include parts of the object are overlapping or that cannot be seen, even though you think you can interpolate the whole shape.</li>
                    <li>Avoid including shadows.</li>
                    <li>If the target is off screen, draw the box up to the edge of the image.</li>
                </ul>
                <p><img src="${TaskTypeImageBoundingBox}" style="max-width:100%" alt="Bounding box good example"></p>
                <h2><span style="color: rgb(0, 138, 0);">Good Example</span></h2><p><img src="[object Object]" style="max-width:100%" alt="Bounding box bad example"></p>
                <h2><span style="color: rgb(230, 0, 0);">Bad Example</span></h2>`,
            keywords: ['Images', 'bounding boxes', 'object detection'],
            autoLabeling: true,
        },
        SemanticSegmentation: {
            enabled: true,
            label: 'Semantic segmentation',
            maxLabelCount: 10,
            minLabelCount: 1,
            description:
                'Get workers to draw pixel level labels around specific objects and segments in your images.',
            value: LabelingJobTypes.SemanticSegmentation,
            image: (
                <img
                    src={TaskTypeImageSemanticSegmentation}
                    alt='Roadway with parked car and a woman on her phone where the car and the woman are colored per pixel.'
                />
            ),
            shortInstruction: `
                <h3><span style="color: rgb(0, 138, 0);">Good example</span></h3><p>Enter description to explain a correctly done segmentation</p><p><img src="${QuickInstructionsExamplePlaceholder}" style="max-width:100%" alt="Add image here"></p><h3><span style="color: rgb(230, 0, 0);">Bad example</span></h3><p>Enter description of an incorrectly done segmentation</p><p><img src="${QuickInstructionsExamplePlaceholder}" style="max-width:100%" alt="Add image here"></p>`,
            fullInstruction: `
                <ol>
                    <li><strong>Read</strong> the task carefully and inspect the image.</li>
                    <li><strong>Read</strong> the options and review the examples provided to understand more about the labels.</li>
                    <li><strong>Choose</strong> the appropriate label that best suits the image.</li>
                </ol>`,
            keywords: ['Images', 'semantic segmentation', 'object detection'],
            autoLabeling: true,
        },
        LabelVerification: {
            enabled: false,
            label: 'Label verification',
            maxLabelCount: 10,
            minLabelCount: 2,
            description: 'Get workers to verify existing labels in your dataset.',
            value: LabelingJobTypes.LabelVerification,
            image: (
                <img
                    src={TaskTypeImageLabelVerification}
                    alt='A labeled car with check boxes of correct label, selected, and incorrect label, not selected.'
                />
            ),
            shortInstruction: `
                <h3>About existing labels</h3>
                <p>Provide instructions to help workers understand the original task. E.g. Workers were asked to create boxes around objects.</p>
                <h3><span style="color: rgb(0, 134, 0);">Good example</span></h3>
                <p>Provide instructions to help workers understand how the task was supposed to be done.</p>
                <p><img src="${QuickInstructionsExamplePlaceholder}" style="max-width:100%" alt="Add image here"></p>
                <h3><span style="color: rgb(230, 0, 0);">Bad example</span></h3>
                <p>Provide examples of mislabeled items that should be rejected.</p>
                <p><img src="${QuickInstructionsExamplePlaceholder}" style="max-width:100%" alt="Add image here"></p>`,
            fullInstruction: `
                <ol>
                    <li><strong>Read</strong> the task carefully and inspect the image.</li>
                    <li><strong>Read</strong> the options and review the examples provided to understand more about the labels.</li>
                    <li><strong>Choose</strong> the appropriate label that best suits the image.</li>
                </ol>`,
            keywords: ['Images', 'categorization', 'classification', 'verification'],
            autoLabeling: false,
        },
    },
    Text: {
        TextMultiClass: {
            enabled: true,
            label: 'Text Classification (Single Label)',
            maxLabelCount: 30,
            minLabelCount: 2,
            description: 'Get workers to categorize text into individual classes.',
            value: LabelingJobTypes.TextMultiClass,
            image: (
                <img
                    src={TaskTypeTextClassification}
                    alt='A document with text and radio button selection of positive, selected, and negative, not selected.'
                />
            ),
            shortInstruction: `
                <p>Enter description of the labels that workers have to choose from</p>
                <p><br></p>
                <p><br></p>
                <p>Add examples to help workers understand the label</p>
                <p><br></p>
                <p><br></p>
                <p><br></p>
                <p><br></p>
                <p><br></p>`,
            fullInstruction: `
                <ol>
                    <li><strong>Read</strong> the text carefully.</li>
                    <li><strong>Read</strong> the examples to understand more about the options.</li>
                    <li><strong>Choose</strong> the appropriate labels that best suit the text.</li>
                </ol>`,
            keywords: ['Text', 'categorization', 'classification'],
            autoLabeling: true,
        },
        TextMultiClassMultiLabel: {
            enabled: true,
            label: 'Text Classification (Multi-label)',
            maxLabelCount: 50,
            minLabelCount: 2,
            description: 'Get workers to categorize text into one or more classes.',
            value: LabelingJobTypes.TextMultiClassMultiLabel,
            image: (
                <img
                    src={TaskTypeTextClassificationMulti}
                    alt='A document with text and check boxes of positive, selected, inspiring, selected, and jargon, not selected.'
                />
            ), // eslint-disable-line
            shortInstruction: `
                <p>Enter description of the labels that workers have to choose from</p> 
                <p><br></p>
                <p><br></p>
                <p>Add examples to help workers understand the label</p>
                <p><br></p>
                <p><br></p>
                <p><br></p>
                <p><br></p>
                <p><br></p>`,
            fullInstruction: `
                <ol>
                    <li><strong>Read</strong> the text carefully.</li>
                    <li><strong>Read</strong> the examples to understand more about the options.</li>
                    <li><strong>Choose</strong> the appropriate labels that best suit the text.</li>
                </ol>`,
            keywords: ['Text', 'categorization', 'classification'],
            autoLabeling: false,
        },
        NamedEntityRecognition: {
            enabled: true,
            label: 'Named entity recognition',
            maxLabelCount: 30,
            minLabelCount: 1,
            description: 'Get workers to apply labels to words or phrases within a larger text.',
            value: LabelingJobTypes.NamedEntityRecognition,
            image: (
                <img
                    src={TaskTypeTextEntityRecognition}
                    alt='A document with colored rectangles and legend which associated a number with the colored rectangle.'
                />
            ),
            shortInstruction: `
                <p>Enter description of the labels that workers have to choose from</p>
                <p><br></p>
                <p><br></p>
                <p>Add examples to help workers understand the label</p>
                <p><br></p>
                <p><br></p>
                <p><br></p>
                <p><br></p>
                <p><br></p>`,
            fullInstruction: `
                <ol>
                    <li><strong>Read</strong> the text carefully.</li>
                    <li><strong>Highlight</strong> words, phrases, or sections of the text.</li>
                    <li><strong>Choose</strong> the label that best matches what you have highlighted.</li>
                    <li>To <strong>change</strong> a label, choose highlighted text and select a new label.</li>
                    <li>To <strong>remove</strong> a label from highlighted text, choose the X next to the abbreviated label name on the highlighted text.</li>
                    <li>You can select all of a previously highlighted text, but not a portion of it.</li>
                </ol>`,
            keywords: ['Text', 'named entity recognition'],
            autoLabeling: false,
        },
    },
};
