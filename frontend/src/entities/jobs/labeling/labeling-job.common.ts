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

import { ILabelingJob } from './labeling-job.model';

export enum LabelingJobTypes {
    BoundingBox = 'BoundingBox',
    ImageMultiClass = 'ImageMultiClass',
    ImageMultiClassMultiLabel = 'ImageMultiClassMultiLabel',
    SemanticSegmentation = 'SemanticSegmentation',
    LabelVerification = 'LabelVerification',
    TextMultiClass = 'TextMultiClass',
    TextMultiClassMultiLabel = 'TextMultiClassMultiLabel',
    NamedEntityRecognition = 'NamedEntityRecognition',
}

// a map of task types mapped to the name provided in these docs:
// https://docs.aws.amazon.com/sagemaker/latest/APIReference/API_HumanTaskConfig.html#SageMaker-Type-HumanTaskConfig-PreHumanTaskLambdaArn
const jobTypeMap = new Map<string, string>([
    [LabelingJobTypes.BoundingBox, 'Bounding box'],
    [LabelingJobTypes.ImageMultiClass, 'Image classification'],
    [LabelingJobTypes.ImageMultiClassMultiLabel, 'Multi-label image classification'],
    [LabelingJobTypes.SemanticSegmentation, 'Semantic segmentation'],
    [LabelingJobTypes.TextMultiClass, 'Text classification'],
    [LabelingJobTypes.TextMultiClassMultiLabel, 'Multi-label text classification'],
    [LabelingJobTypes.NamedEntityRecognition, 'Named entity recognition'],
    ['VideoMultiClass', 'Video Classification'],
    ['VideoObjectDetection', 'Video Frame Object Detection'],
    ['VideoObjectTracking', 'Video Frame Object Tracking'],
    ['3DPointCloudObjectDetection', '3D Point Cloud Object Detection'],
    ['3DPointCloudObjectTracking', '3D Point Cloud Object Tracking'],
    ['3DPointCloudSemanticSegmentation', '3D Point Cloud Semantic Segmentation'],
    ['VerificationBoundingBox', 'Bounding box verification'],
    ['AdjustmentBoundingBox', 'Bounding box adjustment'],
    ['VerificationSemanticSegmentation', 'Semantic segmentation verification'],
    ['AdjustmentSemanticSegmentation', 'Semantic segmentation adjustment'],
    ['AdjustmentVideoObjectDetection', 'Video Frame Object Detection Adjustment'],
    ['AdjustmentVideoObjectTracking', 'Video Frame Object Tracking Adjustment'],
    ['Adjustment3DPointCloudObjectDetection', '3D point cloud object detection adjustment'],
    ['Adjustment3DPointCloudObjectTracking', '3D point cloud object tracking adjustment'],
    [
        'Adjustment3DPointCloudSemanticSegmentation',
        '3D point cloud semantic segmentation adjustment',
    ],
]);

export function getTotalLabelingObjectCount (labelingJob: ILabelingJob): number {
    return labelingJob.LabelCounters
        ? labelingJob.LabelCounters.TotalLabeled + labelingJob.LabelCounters.Unlabeled
        : 0;
}

export function getLabelingJobType (labelingJob: ILabelingJob): string {
    if (!labelingJob.HumanTaskConfig) {
        return '-';
    }
    // ARN will end with something like 'PRE-BoundingBox', so this line will attempt to grab the last string
    // separated by a hyphen. We can then use that in a lookup table for the official job type name.
    const preHumanTaskArnType = labelingJob.HumanTaskConfig.PreHumanTaskLambdaArn.split('-').pop();
    let jobType = 'Custom';
    if (preHumanTaskArnType !== undefined && jobTypeMap.has(preHumanTaskArnType)) {
        jobType = jobTypeMap.get(preHumanTaskArnType)!;
    }
    return jobType;
}
