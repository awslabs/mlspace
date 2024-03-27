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

import { z, ZodType } from 'zod';
import { ObjectiveMetricType } from './hpo/hpo-job.model';
import blazingTextMetadata from '../../shared/algorithmMetadata/blazingText.json';
import blankMetadata from '../../shared/algorithmMetadata/blank.json';
import knnMetadata from '../../shared/algorithmMetadata/knn.json';
import kmeansMetadata from '../../shared/algorithmMetadata/kmeans.json';
import deepARMetadata from '../../shared/algorithmMetadata/forecastingDeepAR.json';
import object2Vec from '../../shared/algorithmMetadata/object2Vec.json';
import imageClassification from '../../shared/algorithmMetadata/imageClassification.json';
import factorizationMachines from '../../shared/algorithmMetadata/factorizationMachines.json';
import semanticSegmentationMetadata from '../../shared/algorithmMetadata/semanticSegmentation.json';
import React, { ReactNode } from 'react';
import xgboostMetadata from '../../shared/algorithmMetadata/xgboost.json';
import { floatValidator, numberValidator, positiveIntValidator } from '../../shared/validation/helpers/numbers';

export type MetricDefinition = {
    metricName: string;
    metricRegex: string;
};

export type ObjectiveMetric = {
    metricName: string;
    metricType: ObjectiveMetricType;
};

export type AlgorithmMetadata = {
    metricDefinitions: MetricDefinition[];
    objectiveMetrics: ObjectiveMetric[];
};
export type Algorithm = {
    active: boolean;
    tunable: boolean;
    displayName: string;
    name: string;
    defaultHyperParameters: Hyperparameter[];
    metadata: AlgorithmMetadata;
};

export enum HyperparameterType {
    CATEGORICAL = 'Categorical',
    CONTINUOUS = 'Continuous',
    INTEGER = 'Integer',
    STATIC = 'Static',
}

export type Hyperparameter = {
    key: string;
    value: string[];
    type: HyperparameterType;
    typeOptions: HyperparameterType[];
    scalingType?: string;
    description?: ReactNode;
    options?: string[] | number[];
    commaSeparatedList?: boolean,
    zValidator?: ZodType<any, any>;
    converter?: (input: any) => any;
};

const linearIntProperties = {
    type: HyperparameterType.INTEGER,
    typeOptions: [HyperparameterType.STATIC, HyperparameterType.INTEGER],
    scalingType: 'Linear',
};

const staticParameterProperties = {
    type: HyperparameterType.STATIC,
    typeOptions: [HyperparameterType.STATIC],
};

const integerParameterProperties = {
    type: HyperparameterType.INTEGER,
    typeOptions: [HyperparameterType.INTEGER, HyperparameterType.STATIC],
};

const categoricalParameterProperties = {
    type: HyperparameterType.CATEGORICAL,
    typeOptions: [HyperparameterType.CATEGORICAL, HyperparameterType.STATIC],
};

const continuousParameterProperties = {
    type: HyperparameterType.CONTINUOUS,
    typeOptions: [HyperparameterType.CONTINUOUS, HyperparameterType.STATIC],
};


export const ML_ALGORITHMS: Algorithm[] = [
    {
        active: true,
        tunable: true,
        displayName: 'Tabular - XGBoost : v1.3',
        name: 'xgboost',
        metadata: xgboostMetadata as AlgorithmMetadata,
        defaultHyperParameters: [{
            ...staticParameterProperties,
            key: 'early_stopping_rounds',
            value: [],
            description: 'The model trains until the validation score stops improving. Validation error needs to decrease at least every early_stopping_rounds to continue training. SageMaker hosting uses the best model for inference.',
            zValidator: numberValidator('early_stopping_rounds',
                {   
                    min: 0
                })
        }, {
            ...staticParameterProperties,
            key: 'csv_weights',
            value: ['0'],
            options: ['0', '1'],
            description: 'When this flag is enabled, XGBoost differentiates the importance of instances for csv input by taking the second column (the column after labels) in training data as the instance weights.',
        }, {
            ...integerParameterProperties,
            scalingType: 'Linear',
            key: 'num_round',
            value: [],
            description: 'The number of rounds to run the training.',
            zValidator: numberValidator('num_round',
                {   
                    min: 1,
                    required: true
                })
        }, {
            ...staticParameterProperties,
            key: 'booster',
            value: ['gbtree'],
            description: 'Which booster to use. The gbtree and dart values use a tree-based model, while gblinear uses a linear function.',
            options: ['gbtree', 'gblinear', 'dart']
        }, {
            ...staticParameterProperties,
            key: 'verbosity',
            value: ['1'],
            options: [0, 1, 2, 3],
            description: 'Verbosity of printing messages.',
        }, {
            ...staticParameterProperties,
            key: 'nthread',
            value: [],
            description: 'Number of parallel threads used to run xgboost.',
            zValidator: numberValidator('nthread',
                {   
                    min: 1
                })
        }, {
            ...continuousParameterProperties,
            scalingType: 'Linear',
            key: 'eta',
            value: ['0.3'],
            description: 'Step size shrinkage used in updates to prevent overfitting. After each boosting step, you can directly get the weights of new features. The eta parameter actually shrinks the feature weights to make the boosting process more conservative.',
            zValidator: numberValidator('eta',
                {   
                    min: 0, 
                    max: 1,
                    isFloat: true 
                })
        }, {
            ...continuousParameterProperties,
            scalingType: 'Linear',
            key: 'gamma',
            value: ['0'],
            description: 'Minimum loss reduction required to make a further partition on a leaf node of the tree. The larger, the more conservative the algorithm is.',
            zValidator: numberValidator('gamma',
                {   
                    min: 0, 
                    isFloat: true
                })
        }, {
            ...integerParameterProperties,
            scalingType: 'Linear',
            key: 'max_depth',
            value: ['6'],
            description: 'Maximum depth of a tree. Increasing this value makes the model more complex and likely to be overfit. 0 indicates no limit. A limit is required when grow_policy=depth-wise.',
            zValidator: numberValidator('max_depth',
                {   
                    min: 0
                })
        }, {
            ...continuousParameterProperties,
            scalingType: 'Linear',
            key: 'min_child_weight',
            value: ['1'],
            description: 'Minimum sum of instance weight (hessian) needed in a child. If the tree partition step results in a leaf node with the sum of instance weight less than min_child_weight, the building process gives up further partitioning. In linear regression models, this simply corresponds to a minimum number of instances needed in each node. The larger the algorithm, the more conservative it is.',
            zValidator: numberValidator('min_child_weight',
                {   
                    min: 0, 
                    isFloat: true
                })
        }, {
            ...integerParameterProperties,
            scalingType: 'Linear',
            key: 'max_delta_step',
            value: ['0'],
            description: 'Maximum delta step allowed for each tree\'s weight estimation. When a positive integer is used, it helps make the update more conservative. The preferred option is to use it in logistic regression. Set it to 1-10 to help control the update.',
            zValidator: numberValidator('max_delta_step',
                {   
                    min: 0,
                })
        }, {
            ...continuousParameterProperties,
            scalingType: 'Linear',
            key: 'subsample',
            value: ['1'],
            description: 'Subsample ratio of the training instance. Setting it to 0.5 means that XGBoost randomly collects half of the data instances to grow trees. This prevents overfitting.',
            zValidator: numberValidator('subsample',
                {   
                    min: 0, 
                    max: 1,
                    isFloat: true,
                    includeMax: false
                })
        }, {
            ...staticParameterProperties,
            scalingType: 'Linear',
            key: 'sampling_method',
            value: ['uniform'],
            options: ['uniform', 'gradient_based'],
        }, {
            ...continuousParameterProperties,
            scalingType: 'Linear',
            key: 'colsample_bytree',
            value: ['1'],
            description: 'Subsample ratio of columns when constructing each tree.',
            zValidator: numberValidator('colsample_bytree',
                {   
                    min: 0, 
                    max: 1,
                    isFloat: true,
                    includeMax: false
                })
        }, {
            ...continuousParameterProperties,
            scalingType: 'Linear',
            key: 'colsample_bylevel',
            value: ['1'],
            description: 'Subsample ratio of columns for each split, in each level.',
            zValidator: numberValidator('colsample_bylevel',
                {   
                    min: 0, 
                    max: 1,
                    isFloat: true,
                    includeMax: false
                })
        }, {
            ...continuousParameterProperties,
            scalingType: 'Linear',
            key: 'lambda',
            value: ['1'],
            description: 'L2 regularization term on weights. Increasing this value makes models more conservative.',
            zValidator: numberValidator('lambda',
                {   
                    min: 0,
                    isFloat: true
                })
        }, {
            ...continuousParameterProperties,
            scalingType: 'Linear',
            key: 'alpha',
            value: ['0.0'],
            description: 'L1 regularization term on weights. Increasing this value makes models more conservative.',
            zValidator: numberValidator('alpha',
                {   
                    min: 0, 
                    isFloat: true
                })
        }, {
            ...staticParameterProperties,
            key: 'tree_method',
            value: ['auto'],
            options: ['auto', 'exact', 'approx', 'hist', 'gpu_hist'],
            description: 'The tree construction algorithm used in XGBoost.',
        }, {
            ...staticParameterProperties,
            key: 'sketch_eps',
            value: ['0.03'],
            description: 'Used only for approximate greedy algorithm. This translates into O(1 / sketch_eps) number of bins. Compared to directly select number of bins, this comes with theoretical guarantee with sketch accuracy.',
            zValidator: numberValidator('sketch_eps',
                {   
                    min: 0, 
                    max: 1,
                    isFloat: true 
                })
        }, {
            ...staticParameterProperties,
            key: 'scale_pos_weight',
            value: ['1'],
            description: 'Controls the balance of positive and negative weights. It\'s useful for unbalanced classes. A typical value to consider: sum(negative cases) / sum(positive cases).',
            zValidator: numberValidator('scale_pos_weight',
                {   
                    min: 0, 
                    isFloat: true 
                })
        }, {
            ...staticParameterProperties,
            key: 'updater',
            value: ['grow_colmaker,prune'],
            options: ['grow_colmaker', 'grow_histmaker', 'grow_local_histmaker', 'grow_quantile_histmaker', 'grow_gpu_hist', 'sync', 'refresh', 'prune'],
            commaSeparatedList: true,
            description: 'A comma-separated string that defines the sequence of tree updaters to run. This provides a modular way to construct and to modify the trees.'
        }, {
            ...staticParameterProperties,
            key: 'dsplit',
            value: ['row'],
            options: ['row', 'col']
        }, {
            ...staticParameterProperties,
            key: 'refresh_leaf',
            value: ['1'],
            options: ['0', '1'],
            description:'This is a parameter of the \'refresh\' updater plug-in. When set to true (1), tree leaves and tree node stats are updated. When set to false(0), only tree node stats are updated.',
        }, {
            ...staticParameterProperties,
            key: 'process_type',
            value: ['default'],
            options: ['default', 'update'],
            description: 'The type of boosting process to run.',
        }, {
            ...staticParameterProperties,
            key: 'grow_policy',
            value: ['depthwise'],
            options: ['depthwise', 'lossguide'],
            description: 'Controls the way that new nodes are added to the tree. Currently supported only if tree_method is set to hist.'
        }, {
            ...staticParameterProperties,
            key: 'max_leaves',
            value: ['0'],
            description: 'Maximum number of nodes to be added. Relevant only if grow_policy is set to lossguide.',
            zValidator: numberValidator('max_leaves',
                {   
                    min: 0 
                })
        }, {
            ...staticParameterProperties,
            key: 'max_bin',
            value: ['256'],
            description: 'Maximum number of discrete bins to bucket continuous features. Used only if tree_method is set to hist.',
            zValidator: numberValidator('max_bin',
                {   
                    min: 0
                })
        }, {
            ...staticParameterProperties,
            key: 'num_parallel_tree',
            value: ['1'],
            zValidator: numberValidator('num_parallel_tree',
                {   
                    min: 1
                })
        }, {
            ...staticParameterProperties,
            key: 'sample_type',
            value: ['uniform'],
            options: ['uniform', 'weighted'],
            description: 'Type of sampling algorithm.',
        }, {
            ...staticParameterProperties,
            key: 'normalize_type',
            value: ['tree'],
            options: ['tree', 'forest'],
            description: 'Type of normalization algorithm.',
        }, {
            ...staticParameterProperties,
            key: 'rate_drop',
            value: ['0.0'],
            description: 'The dropout rate that specifies the fraction of previous trees to drop during the dropout.',
            zValidator: numberValidator('rate_drop',
                {   
                    min: 0, 
                    max: 1,
                    isFloat: true 
                })
        }, {
            ...staticParameterProperties,
            key: 'one_drop',
            value: ['0'],
            options: ['0', '1'],
            description: 'When this flag is enabled, at least one tree is always dropped during the dropout.',
        }, {
            ...staticParameterProperties,
            key: 'skip_drop',
            value: ['0.0'],
            description: 'Probability of skipping the dropout procedure during a boosting iteration.',
            zValidator: numberValidator('skip_drop',
                {   
                    min: 0, 
                    max: 1,
                    isFloat: true 
                })
        }, {
            ...staticParameterProperties,
            key: 'lambda_bias',
            value: ['0.0'],
            description: 'L2 regularization term on bias.',
            zValidator: numberValidator('lambda_bias',
                {   
                    min: 0, 
                    max: 1,
                    isFloat: true 
                })
        }, {
            ...staticParameterProperties,
            key: 'tweedie_variance_power',
            value: ['1.5'],
            description: 'Parameter that controls the variance of the Tweedie distribution.',
            zValidator: numberValidator('tweedie_variance_power',
                {   
                    min: 1, 
                    max: 2,
                    isFloat: true,
                    includeMin: false,
                    includeMax: false
                })
        }, {
            ...staticParameterProperties,
            key: 'objective',
            value: [],
            options: ['reg:squarederror', 'reg:logistic', 'binary:logistic', 'binary:logitraw', 'count:poisson', 'binary:hinge', 'multi:softmax', 'multi:softprob', 'rank:pairwise', 'reg:gamma', 'reg:tweedie'],
            description: 'Specifies the learning task and the corresponding learning objective. Examples: reg:logistic, multi:softmax, reg:squarederror.',
        }, {
            ...staticParameterProperties,
            key: 'num_class',
            value: [],
            description: 'The number of classes.',
            zValidator: numberValidator('num_class')
        }, {
            ...staticParameterProperties,
            key: 'base_score',
            value: ['0.5'],
            description: 'The initial prediction score of all instances, global bias.',
            zValidator: numberValidator('base_score',
                {   
                    isFloat: true 
                })
        }, {
            ...staticParameterProperties,
            key: 'eval_metric',
            value: [],
            options: ['rmse', 'mae', 'logloss', 'error', 'error@t', 'merror', 'mlogloss', 'auc', 'ndcg', 'map', 'ndcg@n', 'map@n', 'ndcg-', 'map-', 'ndcg@n-', 'map@n-'],
            description: 'Evaluation metrics for validation data.',
        }]
    },
    {
        active: false,
        tunable: false,
        displayName: 'Tabular - Linear Learner',
        name: 'linear-learner',
        metadata: blankMetadata as AlgorithmMetadata,
        defaultHyperParameters: []
    },
    {
        active: false,
        tunable: false,
        displayName: 'Vision - Object Detection (MxNet)',
        name: 'object-detection',
        metadata: blankMetadata as AlgorithmMetadata,
        defaultHyperParameters: []
    },
    {
        // Docs: https://docs.aws.amazon.com/sagemaker/latest/dg/segmentation-hyperparameters.html
        active: true,
        tunable: true,
        displayName: 'Vision - Semantic Segmentation (MxNet)',
        name: 'semantic-segmentation',
        metadata: semanticSegmentationMetadata as AlgorithmMetadata,
        defaultHyperParameters: [{
            ...staticParameterProperties,
            key: 'backbone',
            value: ['resnet-50','resnet-101'],
            description: 'The backbone to use for the algorithm\'s encoder component.',
        },
        {
            ...staticParameterProperties,
            value: ['True'],
            options: ['True','False'],
            key: 'use_pretrained_model',
            description: 'Whether a pretrained model is to be used for the backbone.',
        },
        {
            ...staticParameterProperties,
            key: 'algorithm',
            value: ['fcn'],
            options: ['fcn','psp','deeplab'],
            description: 'The algorithm to use for semantic segmentation.',
        },
        {
            ...staticParameterProperties,
            key: 'lr_scheduler',
            value: ['poly'],
            options: ['poly', 'step', 'cosine'],
            description: 'The shape of the learning rate schedule that controls its decrease over time.',
        },
        {
            ...staticParameterProperties,
            key: 'crop_size',
            value: ['240'],
            description: 'The image size for input during training. We randomly rescale the input image based on base_size, and then take a random square crop with side length equal to crop_size. The crop_size will be automatically rounded up to multiples of 8.',
            zValidator: numberValidator('crop_size',
                {   
                    min: 16
                })
        },
        {
            ...staticParameterProperties,
            key: 'num_classes',
            value: [],
            description: 'The number of classes to segment.',
            zValidator: numberValidator('num_classes',
                {   
                    min: 2,
                    max: 254,
                    required: true
                })
        },
        {
            ...staticParameterProperties,
            key: 'num_training_samples',
            value: [],
            description: 'The number of samples in the training data. The algorithm uses this value to set up the learning rate scheduler.',
            zValidator: numberValidator('num_training_samples',
                {   
                    min: 1, // positive integer
                    required: true
                })
        },
        {
            ...staticParameterProperties,
            key: 'epochs',
            value: ['30'],
            description: 'The number of epochs with which to train.',
            zValidator: numberValidator('epochs',
                {   
                    min: 1, // positive integer
                })
        },
        {
            ...staticParameterProperties,
            scalingType: 'Logarithmic',
            key: 'learning_rate',
            value: ['0.001'],
            description: 'The initial learning rate.',
            zValidator: numberValidator('learning_rate',
                {   
                    min: 0, // 0 < float ≤ 1
                    max: 1,
                    includeMin: false,
                    isFloat: true
                })
        },
        {
            ...staticParameterProperties,
            key: 'gamma1',
            value: ['0.90'],
            description: 'The decay factor for the moving average of the squared gradient for rmsprop. Used only for rmsprop.',
            zValidator: numberValidator('gamma1',
                {   
                    min: 0, // 0 ≤ float ≤ 1
                    max: 1,
                    isFloat: true
                })
        },
        {
            ...staticParameterProperties,
            key: 'gamma2',
            value: ['0.90'],
            description: 'The momentum factor for rmsprop.',
            zValidator: numberValidator('gamma2',
                {   
                    min: 0, // 0 ≤ float ≤ 1
                    max: 1,
                    isFloat: true
                })
        },
        {
            ...categoricalParameterProperties,
            key: 'optimizer',
            value: ['sgd','adam','rmsprop','adagrad','nag'], // Docs say default is 'sgd', but in console all are selected
            options: ['sgd','adam','rmsprop','adagrad','nag'],
            description: 'The type of optimizer.',
        },
        {
            ...continuousParameterProperties,
            scalingType: 'Logarithmic',
            key: 'weight_decay',
            value: ['0.0001'],
            description: 'The weight decay coefficient for the sgd optimizer. When you use other optimizers, the algorithm ignores this parameter.',
            zValidator: numberValidator('weight_decay',
                {   
                    min: 0, // 0 < float < 1
                    max: 1,
                    includeMin: false,
                    includeMax: false,
                    isFloat: true
                })
        },
        {
            ...continuousParameterProperties,
            scalingType: 'ReverseLogarithmic',
            key: 'momentum',
            value: ['0.9'],
            description: 'The momentum for the sgd optimizer. When you use other optimizers, the semantic segmentation algorithm ignores this parameter.',
            zValidator: numberValidator('momentum',
                {   
                    min: 0, // 0 < float ≤ 1
                    max: 1,
                    includeMin: false,
                    isFloat: true
                })
        },
        {
            ...integerParameterProperties,
            scalingType: 'Linear',
            key: 'mini_batch_size',
            value: ['16'],
            description: 'The batch size for training. Using a large mini_batch_size usually results in faster training, but it might cause you to run out of memory. Memory usage is affected by the values of the mini_batch_size and image_shape parameters, and the backbone architecture.',
            zValidator: numberValidator('mini_batch_size',
                {   
                    min: 1, // positive integer
                    required: false
                })
        },
        {
            ...staticParameterProperties,
            key: 'validation_mini_batch_size',
            value: ['32'],
            description: 'The batch size for validation. A large mini_batch_size usually results in faster training, but it might cause you to run out of memory. Memory usage is affected by the values of the mini_batch_size and image_shape parameters, and the backbone architecture. ',
            zValidator: numberValidator('validation_mini_batch_size',
                {   
                    min: 1, // positive integer
                    required: true
                })
        },
        {
            ...staticParameterProperties,
            key: 'early_stopping_min_epochs',
            value: ['5'],
            description: 'The minimum number of epochs that must be run.',
            zValidator: numberValidator('early_stopping_min_epochs', 
                {
                    min: 0 // integer
                }) 
        },
        {
            ...staticParameterProperties,
            key: 'early_stopping_patience',
            value: ['4'],
            description: 'The number of epochs that meet the tolerance for lower performance before the algorithm enforces an early stop.',
            zValidator: numberValidator('early_stopping_patience', 
                {
                    min: 0 // integer
                })
        },
        {
            ...staticParameterProperties,
            key: 'early_stopping_tolerance',
            value: ['0.0'],
            description: 'If the relative improvement of the score of the training job, the mIOU, is smaller than this value, early stopping considers the epoch as not improved. This is used only when early_stopping = True.',
            zValidator: numberValidator('early_stopping_tolerance',
                {   
                    min: 0, // 0 ≤ float ≤ 1
                    max: 1,
                    isFloat: true
                })
        },
        {
            ...staticParameterProperties,
            key: 'early_stopping',
            value: ['False'],
            options: ['True','False'],
            description: 'Whether to use early stopping logic during training.',
        }]
    },
    {
        active: false,
        tunable: false,
        displayName: 'Text Transformation - Sequence to Sequence (MxNet)',
        name: 'seq2seq',
        metadata: blankMetadata as AlgorithmMetadata,
        defaultHyperParameters: []
    },
    {
        active: false,
        tunable: false,
        displayName: 'Text Topic Modeling - Neural Topic Modeling (NTM)',
        name: 'ntm',
        metadata: blankMetadata as AlgorithmMetadata,
        defaultHyperParameters: []
    },
    {
        active: false,
        tunable: false,
        displayName: 'Text Topic Modeling -Latent Dirichlet Allocation (LDA)',
        name: 'lda',
        metadata: blankMetadata as AlgorithmMetadata,
        defaultHyperParameters: []
    },
    {
        active: false,
        tunable: false,
        displayName: 'Anomaly Detection - Random Cut Forest',
        name: 'randomcutforest',
        metadata: blankMetadata as AlgorithmMetadata,
        defaultHyperParameters: []
    },
    {
        active: false,
        tunable: false,
        displayName: 'Anomaly Detection - IP Insights',
        name: 'ipinsights',
        metadata: blankMetadata as AlgorithmMetadata,
        defaultHyperParameters: []
    },
    {
        active: true,
        tunable: true,
        displayName: 'Text Classification & Text Embedding - Blazing Text',
        name: 'blazingtext',
        metadata: blazingTextMetadata as AlgorithmMetadata,
        defaultHyperParameters: [
            {
                key: 'mode',
                value: ['skipgram', 'cbow', 'batch_skipgram', 'supervised'],
                ...categoricalParameterProperties,
                options: ['skipgram', 'cbow', 'batch_skipgram', 'supervised'],
                description:
                    'The training mode (Text Classification) or Word2vec architecture used for training.',
            },
            {
                ...linearIntProperties,
                key: 'min_count',
                value: ['5'],
                description: 'Words that appear less than min_count times are discarded.',
                zValidator: positiveIntValidator('min_count'),
            },
            {
                ...linearIntProperties,
                key: 'window_size',
                value: ['5'],
                description:
                    'The size of the context window. The context window is the number of words surrounding the target word used for training.',
                zValidator: positiveIntValidator('window_size'),
            },
            {
                ...linearIntProperties,
                key: 'negative_samples',
                value: ['5'],
                description:
                    'The number of negative samples for the negative sample sharing strategy.',
                zValidator: positiveIntValidator('negative_samples'),
            },
            {
                ...linearIntProperties,
                key: 'epochs',
                value: ['5'],
                description: 'The number of complete passes through the training data.',
                zValidator: positiveIntValidator('epochs'),
            },
            {
                ...linearIntProperties,
                key: 'min_char',
                value: ['3'],
                description:
                    'The minimum number of characters to use for subwords/character n-grams.',
                zValidator: positiveIntValidator('min_char'),
            },
            {
                ...linearIntProperties,
                key: 'max_char',
                value: ['6'],
                description:
                    'The maximum number of characters to use for subwords/character n-grams.',
                zValidator: positiveIntValidator('max_char'),
            },
            {
                ...linearIntProperties,
                key: 'buckets',
                value: ['2000000'],
                description:
                    'The number of hash buckets to use for subwords (Word2Vec) or word n-grams (Text Classification).',
                zValidator: positiveIntValidator('buckets'),
            },
            {
                key: 'subwords',
                value: ['false', 'true'],
                ...categoricalParameterProperties,
                options: ['true', 'false'],
                description: 'Whether to learn subword embeddings on not.',
            },
            {
                ...linearIntProperties,
                key: 'word_ngrams',
                value: ['2'],
                description: 'The number of word n-gram features to use.',
                zValidator: positiveIntValidator('word_ngrams'),
            },
            {
                ...linearIntProperties,
                key: 'vector_dim',
                value: ['100'],
                description:
                    'The dimension of the embedding layer (Text Classification) or word vectors that the algorithm learns (Word2Vec).',
                zValidator: positiveIntValidator('vector_dim'),
            },
            {
                ...linearIntProperties,
                key: 'batch_size',
                value: ['11'],
                description:
                    'The size of each batch when mode is set to batch_skipgram. Set to a number between 10 and 20.',
                zValidator: numberValidator('batch_size', 
                    {   
                        min: 10, 
                        max: 20, 
                    })
            },
            {
                key: 'learning_rate',
                value: ['0.05'],
                ...continuousParameterProperties,
                scalingType: 'Logarithmic',
                description: 'The step size used for parameter updates.',
                zValidator: numberValidator('learning_rate',
                    {   
                        min: 0, 
                        max: 1,
                        isFloat: true 
                    })
            },
            {
                key: 'sampling_threshold',
                value: ['0.0001'],
                ...continuousParameterProperties,
                scalingType: 'Linear',
                description:
                    'The threshold for the occurrence of words. Words that appear with higher frequency in the training data are randomly down-sampled.',
                zValidator: numberValidator('sampling_threshold',
                    {   
                        min: 0, 
                        max: 1,
                        isFloat: true 
                    })
            },
            {
                key: 'min_epochs',
                value: ['5'],
                ...staticParameterProperties,
                description:
                    'The minimum number of epochs to train before early stopping logic is invoked.',
                zValidator: positiveIntValidator('min_epochs'),
            },
            {
                key: 'patience',
                value: ['4'],
                ...staticParameterProperties,
                description:
                    'The number of epochs to wait before applying early stopping when no progress is made on the validation set. Used only when "early_stopping" is "True".',
                zValidator: positiveIntValidator('patience'),
            },
            {
                key: 'early_stopping',
                value: ['false'],
                ...staticParameterProperties,
                options: ['true', 'false'],
                description:
                    'Whether to stop training if validation accuracy doesn\'t improve after a patience number of epochs. Note that a validation channel is required if early stopping is used.',
            },
            {
                key: 'evaluation',
                value: ['true'],
                ...staticParameterProperties,
                options: ['true', 'false'],
                description:
                    'Whether the trained model is evaluated using the WordSimilarity-353 Test.',
            },
        ],
    },
    {
        active: true,
        tunable: true,
        displayName: 'Tabular - K Nearest Neighbors (KNN)',
        name: 'knn',
        metadata: knnMetadata as AlgorithmMetadata,
        defaultHyperParameters: [
            {
                key: 'feature_dim',
                value: [''],
                ...staticParameterProperties,
                zValidator: positiveIntValidator('feature_dim', { required: true }),
                description: 'The number of features in the input data.',
            },
            {
                key: 'mini_batch_size',
                value: ['5000'],
                ...staticParameterProperties,
                zValidator: positiveIntValidator('mini_batch_size'),
                description: 'The number of observations per mini-batch for the data iterator.',
            },
            {
                key: 'k',
                value: [''],
                ...integerParameterProperties,
                scalingType: 'Auto',
                zValidator: positiveIntValidator('k', { required: true }),
                description: 'The number of nearest neighbors.',
            },
            {
                key: 'predictor_type',
                value: ['classifier'],
                ...staticParameterProperties,
                options: ['classifier', 'regressor'],
                zValidator: z.string().min(1, { message: 'predictor_type is required' }),
                description: 'The type of inference to use on the data labels.',
            },
            {
                key: 'sample_size',
                value: [''],
                ...linearIntProperties,
                zValidator: positiveIntValidator('sample_size', { required: true }),
                description: 'The number of data points to be sampled from the training data set.',
            },
            {
                key: 'dimension_reduction_type',
                value: [''],
                ...staticParameterProperties,
                options: ['', 'sign', 'fjlt'],
                description: 'The type of dimension reduction method.',
            },
            {
                key: 'dimension_reduction_target',
                value: [''],
                ...staticParameterProperties,
                zValidator: z.preprocess(
                    Number,
                    z
                        .number({
                            invalid_type_error:
                                'dimension_reduction_target is required and must be a positive integer less than feature_dim',
                        })
                        .min(1, {
                            message:
                                'dimension_reduction_target is required and must be a positive integer less than feature_dim',
                        })
                ),
                description: 'The target dimension to reduce to.',
            },
            {
                key: 'index_type',
                value: ['faiss.Flat'],
                ...staticParameterProperties,
                options: ['faiss.Flat', 'faiss.IVFFlat', 'faiss.IVFPQ'],
                description: 'The type of index.',
            },
            {
                key: 'index_metric',
                value: ['L2'],
                ...staticParameterProperties,
                options: ['L2', 'INNER_PRODUCT', 'COSINE'],
                description:
                    'The metric to measure the distance between points when finding nearest neighbors. When training with index_type set to faiss.IVFPQ, the INNER_PRODUCT distance and COSINE similarity are not supported.',
            },
            {
                key: 'faiss_index_ivf_nlists',
                value: ['auto'],
                ...staticParameterProperties,
                zValidator: positiveIntValidator('faiss_index_ivf_nlists', { alternateValues: ['auto'] }), // auto or int
                description:
                    'The number of centroids to construct in the index when index_type is faiss.IVFFlat or faiss.IVFPQ.',
            },
            {
                key: 'faiss_index_pq_m',
                value: [''],
                ...staticParameterProperties,
                options: [1, 2, 3, 4, 8, 12, 16, 20, 24, 28, 32, 40, 48, 56, 64, 96],
                description:
                    'The number of vector sub-components to construct in the index when index_type is set to faiss.IVFPQ. ',
            },
        ],
    },
    {
        active: true,
        tunable: true,
        displayName: 'Tabular - Factorization Machines',
        name: 'factorization-machines',
        metadata: factorizationMachines as AlgorithmMetadata,
        defaultHyperParameters: [
            {
                key: 'feature_dim',
                value: [''],
                ...staticParameterProperties,
                zValidator: positiveIntValidator('feature_dim', { required: true }),
                description:
                    'The dimension of the input feature space. This could be very high with sparse input. Suggested value range: [10000,10000000].',
            },
            {
                key: 'mini_batch_size',
                value: ['1000'],
                ...linearIntProperties,
                zValidator: positiveIntValidator('mini_batch_size'),
                description: 'The size of mini-batch used for training.',
            },
            {
                key: 'epochs',
                value: ['1'],
                ...linearIntProperties,
                zValidator: positiveIntValidator('epochs'),
                description: 'The number of training epochs to run.',
            },
            {
                key: 'num_factors',
                value: [''],
                ...staticParameterProperties,
                zValidator: numberValidator('num_factors', { min: 2, required: true }),
                description:
                    'The dimensionality of factorization. Suggested value range: [2,1000], 64 typically generates good outcomes and is a good starting point.',
            },
            {
                key: 'predictor_type',
                value: ['binary_classifier'],
                ...staticParameterProperties,
                options: ['binary_classifier', 'regressor'],
                description:
                    'The type of predictor. \'binary_classifier\': For binary classification tasks. \'regressor\': For regression tasks.',
            },
            {
                key: 'clip_gradient',
                value: [''],
                ...staticParameterProperties,
                zValidator: floatValidator('clip_gradient'),
                description:
                    'Gradient clipping optimizer parameter. Clips the gradient by projecting onto the interval [-clip_gradient, +clip_gradient].',
            },
            {
                key: 'eps',
                value: [''],
                ...staticParameterProperties,
                zValidator: floatValidator('eps'),
                description:
                    'Epsilon parameter to avoid division by 0. A small value is suggested.',
            },
            {
                key: 'rescale_grad',
                value: [''],
                ...staticParameterProperties,
                zValidator: floatValidator('rescale_grad'),
                description:
                    'Gradient rescaling optimizer parameter. If set, multiplies the gradient with rescale_grad before updating. Often choose to be 1.0/batch_size. ',
            },
            {
                key: 'bias_lr',
                value: ['0.1'],
                ...continuousParameterProperties,
                scalingType: 'Logarithmic',
                zValidator: floatValidator('bias_lr', false, true),
                description:
                    'The learning rate for the bias term. Suggested value range: [1e-8, 512].',
            },
            {
                key: 'linear_lr',
                value: ['0.001'],
                ...continuousParameterProperties,
                scalingType: 'Logarithmic',
                zValidator: floatValidator('linear_lr', false, true),
                description:
                    'The learning rate for linear terms. Suggested value range: [1e-8, 512].',
            },
            {
                key: 'factors_lr',
                value: ['0.0001'],
                ...continuousParameterProperties,
                scalingType: 'Logarithmic',
                zValidator: floatValidator('factors_lr', false, true),
                description:
                    'The learning rate for factorization terms. Suggested value range: [1e-8, 512].',
            },
            {
                key: 'bias_wd',
                value: ['0.01'],
                ...continuousParameterProperties,
                scalingType: 'Logarithmic',
                zValidator: floatValidator('bias_wd', false, true),
                description:
                    'The weight decay for the bias term. Suggested value range: [1e-8, 512].',
            },
            {
                key: 'linear_wd',
                value: ['0.001'],
                ...continuousParameterProperties,
                scalingType: 'Logarithmic',
                zValidator: floatValidator('linear_wd', false, true),
                description:
                    'The weight decay for linear terms. Suggested value range: [1e-8, 512].',
            },
            {
                key: 'factors_wd',
                value: ['0.00001'],
                ...continuousParameterProperties,
                scalingType: 'Logarithmic',
                zValidator: floatValidator('factors_wd', false, true),
                description:
                    'The weight decay for factorization terms. Suggested value range: [1e-8, 512].',
            },
            {
                key: 'bias_init_method',
                value: ['normal'],
                ...staticParameterProperties,
                options: ['uniform', 'normal', 'constant'],
                description: 'The initialization method for the bias term.',
            },
            {
                key: 'bias_init_scale',
                value: [''],
                ...continuousParameterProperties,
                scalingType: 'Logarithmic',
                zValidator: floatValidator('bias_init_scale', false, true),
                description:
                    'Range for initialization of the bias term. Takes effect if bias_init_method is set to uniform. Suggested value range: [1e-8, 512].',
            },
            {
                key: 'bias_init_sigma',
                value: ['0.01'],
                ...continuousParameterProperties,
                scalingType: 'Logarithmic',
                zValidator: floatValidator('bias_init_sigma', false, true),
                description:
                    'The standard deviation for initialization of the bias term. Takes effect if bias_init_method is set to normal. Suggested value range: [1e-8, 512].',
            },
            {
                key: 'bias_init_value',
                value: [''],
                ...continuousParameterProperties,
                scalingType: 'Logarithmic',
                zValidator: floatValidator('bias_init_value'),
                description:
                    'The initial value of the bias term. Takes effect if bias_init_method is set to constant. Suggested value range: [1e-8, 512].',
            },
            {
                key: 'linear_init_method',
                value: ['normal'],
                ...staticParameterProperties,
                options: ['uniform', 'normal', 'constant'],
                description: 'The initialization method for linear terms.',
            },
            {
                key: 'linear_init_scale',
                value: [''],
                ...continuousParameterProperties,
                scalingType: 'Logarithmic',
                zValidator: floatValidator('linear_init_scale', false, true),
                description:
                    'Range for initialization of linear terms. Takes effect if linear_init_method is set to uniform. Suggested value range: [1e-8, 512].',
            },
            {
                key: 'linear_init_sigma',
                value: ['0.01'],
                ...continuousParameterProperties,
                scalingType: 'Logarithmic',
                zValidator: floatValidator('linear_init_sigma', false, true),
                description:
                    'The standard deviation for initialization of linear terms. Takes effect if linear_init_method is set to normal. Suggested value range: [1e-8, 512].',
            },
            {
                key: 'linear_init_value',
                value: [''],
                ...continuousParameterProperties,
                scalingType: 'Logarithmic',
                zValidator: floatValidator('linear_init_value'),
                description:
                    'The initial value of linear terms. Takes effect if linear_init_method is set to constant. Suggested value range: [1e-8, 512].',
            },
            {
                key: 'factors_init_method',
                value: ['normal'],
                ...staticParameterProperties,
                options: ['uniform', 'normal', 'constant'],
                description: 'The initialization method for factorization terms.',
            },
            {
                key: 'factors_init_scale',
                value: [''],
                ...continuousParameterProperties,
                scalingType: 'Logarithmic',
                zValidator: floatValidator('factors_init_scale', false, true),
                description:
                    'The range for initialization of factorization terms. Takes effect if factors_init_method is set to uniform. Suggested value range: [1e-8, 512].',
            },
            {
                key: 'factors_init_sigma',
                value: [''],
                ...continuousParameterProperties,
                scalingType: 'Logarithmic',
                zValidator: floatValidator('factors_init_sigma', false, true),
                description:
                    'The standard deviation for initialization of factorization terms. Takes effect if factors_init_method is set to normal. Suggested value range: [1e-8, 512].',
            },
            {
                key: 'factors_init_value',
                value: [''],
                ...continuousParameterProperties,
                scalingType: 'Logarithmic',
                zValidator: floatValidator('factors_init_value'),
                description:
                    'The initial value of factorization terms. Takes effect if factors_init_method is set to constant. Suggested value range: [1e-8, 512].',
            },
        ],
    },
    {
        active: true,
        tunable: true,
        displayName: 'Tabular - Object2Vec',
        name: 'object2vec',
        metadata: object2Vec as AlgorithmMetadata,
        defaultHyperParameters: [
            {
                key: 'enc_dim',
                value: ['4096'],
                ...linearIntProperties,
                zValidator: numberValidator('enc_dim',
                    {   
                        min: 4, 
                        max: 10000,
                    }),
                description: 'The dimension of the output of the embedding layer.',
            },
            {
                key: 'mini_batch_size',
                value: ['32'],
                ...linearIntProperties,
                zValidator: numberValidator('mini_batch_size',
                    {   
                        min: 1, 
                        max: 10000,
                    }),
                description:
                    'The batch size that the dataset is split into for an optimizer during training.',
            },
            {
                key: 'epochs',
                value: ['20'],
                ...linearIntProperties,
                zValidator: numberValidator('epochs',
                    {   
                        min: 1, 
                        max: 100,
                        required: true
                    }),
                description: 'The number of epochs to run for training. ',
            },
            {
                key: 'early_stopping_tolerance',
                value: ['0.01'],
                ...continuousParameterProperties,
                scalingType: 'Linear',
                zValidator: numberValidator('early_stopping_tolerance',
                    {   
                        min: 0.000001, 
                        max: 0.1,
                        isFloat: true,
                    }),
                description:
                    'The reduction in the loss function that an algorithm must achieve between consecutive epochs to avoid early stopping after the number of consecutive epochs specified in the early_stopping_patience hyperparameter concludes.',
            },
            {
                key: 'early_stopping_patience',
                value: ['3'],
                ...linearIntProperties,
                zValidator: numberValidator('early_stopping_patience',
                    {   
                        min: 1, 
                        max: 5,
                    }),
                description:
                    'The number of consecutive epochs without improvement allowed before early stopping is applied. Improvement is defined by the early_stopping_tolerance hyperparameter.',
            },
            {
                key: 'dropout',
                value: ['0.0'],
                ...continuousParameterProperties,
                scalingType: 'Linear',
                zValidator: numberValidator('dropout',
                    {   
                        min: 0, 
                        max: 1,
                        isFloat: true
                    }),
                description:
                    'The dropout probability for network layers. Dropout is a form of regularization used in neural networks that reduces overfitting by trimming codependent neurons.',
            },
            {
                key: 'weight_decay',
                value: ['0.0'],
                ...continuousParameterProperties,
                scalingType: 'Logarithmic',
                zValidator: numberValidator('weight_decay',
                    {   
                        min: 0, 
                        max: 10000,
                        isFloat: true,
                    }),
                description: 'The weight decay parameter used for optimization.',
            },
            {
                key: 'bucket_width',
                value: ['0'],
                ...staticParameterProperties,
                zValidator: numberValidator('bucket_width',
                    {   
                        min: 0, 
                        max: 100
                    }),
                description:
                    'The allowed difference between data sequence length when bucketing is enabled. To enable bucketing, specify a non-zero value for this parameter.',
            },
            {
                key: 'num_classes',
                value: ['2'],
                ...staticParameterProperties,
                zValidator: numberValidator('num_classes',
                    {   
                        min: 2, 
                        max: 30
                    }),
                description:
                    'The number of classes for classification training. Amazon SageMaker ignores this hyperparameter for regression problems.',
            },
            {
                key: 'mlp_layers',
                value: ['2'],
                ...linearIntProperties,
                zValidator: numberValidator('mlp_layers',
                    {   
                        min: 0, 
                        max: 10
                    }),
                description: 'The number of MLP layers in the network.',
            },
            {
                key: 'mlp_dim',
                value: ['512'],
                ...linearIntProperties,
                zValidator: numberValidator('mlp_dim',
                    {   
                        min: 2, 
                        max: 10000
                    }),
                description: 'The dimension of the output from MLP layers.',
            },
            {
                key: 'mlp_activation',
                value: ['linear', 'relu', 'tanh'],
                ...categoricalParameterProperties,
                options: ['tanh', 'relu', 'linear'],
                description:
                    'The type of activation function for the multilayer perceptron (MLP) layer.',
            },
            {
                key: 'output_layer',
                value: ['softmax'],
                ...staticParameterProperties,
                options: ['softmax', 'mean_squared_error'],
                description:
                    'The type of output layer where you specify that the task is regression or classification.',
            },
            {
                key: 'optimizer',
                value: ['adam', 'adadelta', 'adagrad', 'sgd', 'rmsprop'],
                ...categoricalParameterProperties,
                options: ['adam', 'adadelta', 'adagrad', 'sgd', 'rmsprop'],
                description: 'The optimizer type.',
            },
            {
                key: 'learning_rate',
                value: ['0.0004'],
                ...continuousParameterProperties,
                scalingType: 'Logarithmic',
                zValidator: numberValidator('learning_rate',
                    {   
                        min: 0.000001, 
                        max: 1,
                        isFloat: true
                    }),
                description: 'The learning rate for training.',
            },
            {
                key: 'negative_sampling_rate',
                value: ['0'],
                ...staticParameterProperties,
                zValidator: numberValidator('negative_sampling_rate',
                    {   
                        min: 0, 
                        max: 100
                    }),
                description:
                    'The ratio of negative samples, generated to assist in training the algorithm, to positive samples that are provided by users. Negative samples represent data that is unlikely to occur in reality and are labeled negatively for training.',
            },
            {
                key: 'tied_token_embedding_weight',
                value: ['true'],
                ...staticParameterProperties,
                options: ['true', 'false'],
                description:
                    'Whether to use a shared embedding layer for both encoders. If the inputs to both encoders use the same token-level units, use a shared token embedding layer.',
            },
            {
                key: 'token_embedding_storage_type',
                value: ['dense', 'row_sparse'],
                ...staticParameterProperties,
                options: ['dense', 'row_sparse'],
                description:
                    'The mode of gradient update used during training: when the dense mode is used, the optimizer calculates the full gradient matrix for the token embedding layer even if most rows of the gradient are zero-valued.',
            },
            {
                key: 'comparator_list',
                value: ['hadamard, concat, abs_diff'],
                ...staticParameterProperties,
                description:
                    'Valid values: a string that contains any combination of the names of the three binary operators: hadamard, concat, or abs_diff.',
            },
            {
                key: 'enc0_network',
                value: ['hcnn'],
                ...staticParameterProperties,
                options: ['hcnn', 'bilstm', ' pooled_embedding'],
                description:
                    'The network model for the enc0 encoder; hcnn is a hierarchical convolutional neural network, bilstm is a bidirectional long short-term memory network, and pooled_embedding averages the embeddings of all of the tokens in the input.',
            },
            {
                key: 'enc1_network',
                value: ['enc0'],
                ...staticParameterProperties,
                options: ['enc0', 'hcnn', 'bilstm', ' pooled_embedding'],
                description:
                    'The network model for the enc1 encoder. If you want the enc1 encoder to use the same network model as enc0, including the hyperparameter values, set the value to enc0.',
            },
            {
                key: 'enc0_cnn_filter_width',
                value: ['3'],
                ...linearIntProperties,
                zValidator: numberValidator('enc0_cnn_filter_width',
                    {   
                        min: 3, 
                        max: 9
                    }),
                description:
                    'The filter width of the convolutional neural network (CNN) enc0 encoder.',
            },
            {
                key: 'enc0_max_seq_len',
                value: ['100'],
                ...staticParameterProperties,
                zValidator: numberValidator('enc0_max_seq_len',
                    {   
                        min: 1, 
                        max: 500
                    }),
                description: 'The maximum sequence length for the enc0 encoder.',
            },
            {
                key: 'enc0_token_embedding_dim',
                value: ['300'],
                ...linearIntProperties,
                zValidator: numberValidator('enc0_token_embedding_dim',
                    {   
                        min: 2, 
                        max: 1000
                    }),
                description: 'The output dimension of the enc0 token embedding layer.',
            },
            {
                key: 'enc0_vocab_size',
                value: [''],
                ...staticParameterProperties,
                zValidator: numberValidator('enc0_vocab_size',
                    {   
                        min: 2, 
                        max: 3000000,
                        required: true
                    }),
                description: 'The vocabulary size of enc0 tokens.',
            },
            {
                key: 'enc0_vocab_file',
                value: [''],
                ...staticParameterProperties,
                zValidator: z.string().regex(/^[a-zA-Z0-9._]*$/, {
                    message:
                        'enc0_vocab_file must be a string with alphanumeric characters, underscore, or period. [A-Za-z0-9._]',
                }),
                description:
                    'The vocabulary file for mapping pretrained enc0 token embedding vectors to numerical vocabulary IDs.',
            },
            {
                key: 'enc0_layers',
                value: ['auto'],
                ...linearIntProperties,
                zValidator: numberValidator('enc0_layers',
                    {   
                        min: 1, 
                        max: 4,
                        alternateValues: ['auto']
                    }),
                description:
                    'The number of layers in the enc0 encoder. For hcnn, auto means 4. For bilstm, auto means 1. For pooled_embedding, auto ignores the number of layers.',
            },
            {
                key: 'enc0_pretrained_embedding_file',
                value: [''],
                ...staticParameterProperties,
                zValidator: z.string().regex(/^[a-zA-Z0-9._]*$/, {
                    message:
                        'enc0_pretrained_embedding_file must be a string with alphanumeric characters, underscore, or period. [A-Za-z0-9._]',
                }),
                description:
                    'The filename of the pretrained enc0 token embedding file in the auxiliary data channel.',
            },
            {
                key: 'enc0_freeze_pretrained_embedding',
                value: ['true'],
                ...staticParameterProperties,
                options: ['true', 'false'],
                description: 'Whether to freeze enc0 pretrained embedding weights.',
            },
            {
                key: 'enc1_cnn_filter_width',
                value: [''],
                ...staticParameterProperties,
                zValidator: numberValidator('enc1_cnn_filter_width',
                    {   
                        min: 3, 
                        max: 9
                    }),
                description: 'The filter width of the CNN enc1 encoder.',
            },
            {
                key: 'enc1_max_seq_len',
                value: [''],
                ...staticParameterProperties,
                zValidator: numberValidator('enc1_max_seq_len',
                    {   
                        min: 1, 
                        max: 500
                    }),
                description: 'The maximum sequence length for the enc1 encoder.',
            },
            {
                key: 'enc1_token_embedding_dim',
                value: [''],
                ...linearIntProperties,
                zValidator: numberValidator('enc1_token_embedding_dim',
                    {   
                        min: 2, 
                        max: 1000
                    }),
                description: 'The output dimension of the enc1 token embedding layer.',
            },
            {
                key: 'enc1_vocab_size',
                value: [''],
                ...staticParameterProperties,
                zValidator: numberValidator('enc1_vocab_size',
                    {   
                        min: 2, 
                        max: 3000000
                    }),
                description: 'The vocabulary size of enc1 tokens.',
            },
            {
                key: 'enc1_vocab_file',
                value: [''],
                ...staticParameterProperties,
                zValidator: z.string().regex(/^[a-zA-Z0-9._]*$/, {
                    message:
                        'enc1_vocab_file must be a string with alphanumeric characters, underscore, or period. [A-Za-z0-9._]',
                }),
                description:
                    'The vocabulary file for mapping pretrained enc1 token embedding vectors to numerical vocabulary IDs.',
            },
            {
                key: 'enc1_layers',
                value: [''],
                ...linearIntProperties,
                zValidator: numberValidator('enc1_layers',
                    {   
                        min: 1, 
                        max: 4
                    }),
                description:
                    'The number of layers in the enc1 encoder. For hcnn, auto means 4. For bilstm, auto means 1. For pooled_embedding, auto ignores the number of layers.',
            },
            {
                key: 'enc1_pretrained_embedding_file',
                value: [''],
                ...staticParameterProperties,
                zValidator: z.string().regex(/^[a-zA-Z0-9._]*$/, {
                    message:
                        'enc1_pretrained_embedding_file must be a string with alphanumeric characters, underscore, or period. [A-Za-z0-9._]',
                }),
                description:
                    'The name of the enc1 pretrained token embedding file in the auxiliary data channel.',
            },
            {
                key: 'enc1_freeze_pretrained_embedding',
                value: ['true'],
                ...staticParameterProperties,
                options: ['true', 'false'],
                description: 'Whether to freeze enc1 pretrained embedding weights.',
            },
        ],
    },
    {
        active: true,
        tunable: true,
        displayName: 'Vision - ImageClassification (MxNet)',
        name: 'image-classification',
        metadata: imageClassification as AlgorithmMetadata,
        defaultHyperParameters: [
            {
                key: 'use_pretrained_model',
                value: ['0'],
                ...staticParameterProperties,
                options: ['0', '1'],
                description:
                    'Flag to use pre-trained model for training. If set to 1, then the pretrained model with the corresponding number of layers is loaded and used for training. Only the top FC layer are reinitialized with random weights. Otherwise, the network is trained from scratch.',
            },
            {
                key: 'multi_label',
                value: ['0'],
                ...staticParameterProperties,
                options: ['0', '1'],
                description:
                    'Flag to use for multi-label classification where each sample can be assigned multiple labels. Average accuracy across all classes is logged.',
            },
            {
                key: 'use_weighted_loss',
                value: ['0'],
                ...staticParameterProperties,
                options: ['0', '1'],
                description:
                    'Flag to use weighted cross-entropy loss for multi-label classification (used only when multi_label = 1), where the weights are calculated based on the distribution of classes.',
            },
            {
                key: 'checkpoint_frequency',
                value: ['1'],
                ...staticParameterProperties,
                zValidator: numberValidator('checkpoint_frequency',
                    {   
                        min: 1, 
                        max: 50
                    }),
                description:
                    'Period to store model parameters (in number of epochs). Must be no greater than the epochs value.',
            },
            {
                key: 'precision_dtype',
                value: ['float32'],
                ...staticParameterProperties,
                options: ['float32', 'float16'],
                description:
                    'The precision of the weights used for training. The algorithm can use either single precision (float32) or half precision (float16) for the weights. Using half-precision for weights results in reduced memory consumption.',
            },
            {
                key: 'num_layers',
                value: ['152'],
                ...staticParameterProperties,
                options: ['18', '20', '32', '34', '44', '50', '56', '101', '110', '152', '200'],
                description:
                    'Number of layers for the network. For data with large image size (for example, 224x224 - like ImageNet), we suggest selecting the number of layers from the set [18, 34, 50, 101, 152, 200]. For data with small image size (for example, 28x28 - like CIFAR), we suggest selecting the number of layers from the set [20, 32, 44, 56, 110]. For transfer learning, the number of layers defines the architecture of base network and hence can only be selected from the set [18, 34, 50, 101, 152, 200].',
            },
            {
                key: 'resize',
                value: [''],
                ...staticParameterProperties,
                zValidator: numberValidator('resize', { min: 5 }),
                description:
                    'Required when using image content types. Optional when using the RecordIO content type. The number of pixels in the shortest side of an image after resizing it for training. If the parameter is not set, then the training data is used without resizing. The parameter should be larger than both the width and height components of image_shape to prevent training failure.',
            },
            {
                key: 'epochs',
                value: ['30'],
                ...staticParameterProperties,
                zValidator: positiveIntValidator('epoch'),
                description: 'Number of training epochs.',
            },
            {
                key: 'learning_rate',
                value: ['0.1'],
                ...continuousParameterProperties,
                scalingType: 'Logarithmic',
                zValidator: numberValidator('learning_rate',
                    {   
                        min: 0.0000000001, 
                        max: 1,
                        isFloat: true
                    }),
                description: 'The learning rate for training.',
            },
            {
                key: 'lr_scheduler_factor',
                value: ['0.1'],
                ...staticParameterProperties,
                zValidator: numberValidator('lr_scheduler_factor',
                    {   
                        min: 0.0000000001, 
                        max: 1,
                        isFloat: true
                    }),
                description:
                    'The ratio to reduce learning rate used in conjunction with the lr_scheduler_step parameter, defined as lr_new = lr_old * lr_scheduler_factor.',
            },
            {
                key: 'lr_scheduler_step',
                value: [''],
                ...staticParameterProperties,
                zValidator: z
                    .string()
                    .regex(/^(([1-9][0-9]*)(,[1-9][0-9]*)*)$/, {
                        message:
                            'lr_scheduler_step must be a string with adhering to the regex \'^(([1-9][0-9]*)(,[1-9][0-9]*)*)$\'',
                    })
                    .optional()
                    .or(z.literal('')),
                description:
                    'The epochs at which to reduce the learning rate. As explained in the lr_scheduler_factor parameter, the learning rate is reduced by lr_scheduler_factor at these epochs. For example, if the value is set to "10, 20", then the learning rate is reduced by lr_scheduler_factor after 10th epoch and again by lr_scheduler_factor after 20th epoch. The epochs are delimited by ",".',
            },
            {
                key: 'optimizer',
                value: ['sgd', 'adam', 'rmsprop', 'nag'],
                ...categoricalParameterProperties,
                options: ['sgd', 'adam', 'rmsprop', 'nag'],
                description: 'The optimizer type.',
            },
            {
                key: 'momentum',
                value: ['0.9'],
                ...continuousParameterProperties,
                scalingType: 'ReverseLogarithmic',
                zValidator: numberValidator('momentum',
                    {   
                        min: 0.0000000001, 
                        max: 1,
                        isFloat: true
                    }),
                description: 'The momentum for sgd and nag, ignored for other optimizers.',
            },
            {
                key: 'weight_decay',
                value: ['0.0001'],
                ...continuousParameterProperties,
                scalingType: 'Logarithmic',
                zValidator: numberValidator('weight_decay',
                    {   
                        min: 0.0000000001, 
                        max: 1,
                        isFloat: true
                    }),
                description:
                    'The coefficient weight decay for sgd and nag, ignored for other optimizers.',
            },
            {
                key: 'beta_1',
                value: ['0.9'],
                ...continuousParameterProperties,
                scalingType: 'ReverseLogarithmic',
                zValidator: numberValidator('beta_1',
                    {   
                        min: 0.0000000001, 
                        max: 1,
                        isFloat: true
                    }),
                description:
                    'The beta1 for adam, that is the exponential decay rate for the first moment estimates.',
            },
            {
                key: 'beta_2',
                value: ['0.999'],
                ...continuousParameterProperties,
                scalingType: 'ReverseLogarithmic',
                zValidator: numberValidator('beta_2',
                    {   
                        min: 0.0000000001, 
                        max: 1,
                        isFloat: true
                    }),
                description:
                    'The beta2 for adam, that is the exponential decay rate for the second moment estimates.',
            },
            {
                key: 'eps',
                value: ['0.00000001'],
                ...continuousParameterProperties,
                scalingType: 'Logarithmic',
                zValidator: numberValidator('eps',
                    {   
                        min: 0.0000000001, 
                        max: 1,
                        isFloat: true,
                    }),
                description:
                    'The epsilon for adam and rmsprop. It is usually set to a small value to avoid division by 0.',
            },
            {
                key: 'gamma',
                value: ['0.9'],
                ...continuousParameterProperties,
                scalingType: 'ReverseLogarithmic',
                zValidator: numberValidator('gamma',
                    {   
                        min: 0.0000000001, 
                        max: 1,
                        isFloat: true
                    }),
                description:
                    'The gamma for rmsprop, the decay factor for the moving average of the squared gradient.',
            },
            {
                key: 'mini_batch_size',
                value: ['32'],
                ...linearIntProperties,
                scalingType: 'Logarithmic',
                zValidator: positiveIntValidator('mini_batch_size'),
                description:
                    'The batch size for training. In a single-machine multi-GPU setting, each GPU handles mini_batch_size/num_gpu training samples. For the multi-machine training in dist_sync mode, the actual batch size is mini_batch_size*number of machines. See MXNet docs for more details.',
            },
            {
                key: 'image_shape',
                value: ['3,224,224'],
                ...staticParameterProperties,
                zValidator: z
                    .string()
                    .regex(/^(([1-9][0-9]*)(,[1-9][0-9]*)(,[1-9][0-9]*))$/, {
                        message:
                            'image_shape must be a string with adhering to the regex \'/^(([1-9][0-9]*)(,[1-9][0-9]*)(,[1-9][0-9]*))$/\'',
                    })
                    .optional()
                    .or(z.literal('')),
                description:
                    'Required when using image content types. Optional when using the RecordIO content type. The input image dimensions, which is the same size as the input layer of the network. The format is defined as \'num_channels, height, width\'.',
            },
            {
                key: 'num_classes',
                value: [''],
                ...staticParameterProperties,
                zValidator: positiveIntValidator('num_classes', { required: true }),
                description:
                    'Number of output classes. This parameter defines the dimensions of the network output and is typically set to the number of classes in the dataset.',
            },
            {
                key: 'num_training_samples',
                value: [''],
                ...staticParameterProperties,
                zValidator: positiveIntValidator('num_training_samples', { required: true }),
                description:
                    'Number of training examples in the input dataset. If there is a mismatch between this value and the number of samples in the training set, then the behavior of the lr_scheduler_step parameter is undefined and distributed training accuracy might be affected.',
            },
            {
                key: 'augmentation_type',
                value: [''],
                ...staticParameterProperties,
                options: ['crop', 'crop_color', ' crop_color_transform'],
                description:
                    'Data augmentation type. The input images can be augmented in multiple ways.',
            },
            {
                key: 'top_k',
                value: [''],
                ...staticParameterProperties,
                zValidator: numberValidator('top_k', { min: 2 }),
                description:
                    'Reports the top-k accuracy during training. This parameter has to be greater than 1, since the top-1 training accuracy is the same as the regular training accuracy that has already been reported.',
            },
            {
                key: 'kv_store',
                value: [''],
                ...staticParameterProperties,
                options: ['dist_sync', 'dist_async'],
                description:
                    'Weight update synchronization mode during distributed training. The weight updates can be updated either synchronously or asynchronously across machines. Synchronous updates typically provide better accuracy than asynchronous updates but can be slower.',
            },
            {
                key: 'early_stopping',
                value: ['false'],
                ...staticParameterProperties,
                options: ['true', 'false'],
                description:
                    'True to use early stopping logic during training. False not to use it.',
            },
            {
                key: 'early_stopping_min_epochs',
                value: ['10'],
                ...staticParameterProperties,
                zValidator: numberValidator('early_stopping_min_epochs',
                    {   
                        min: 1, 
                        max: 1000000
                    }),
                description:
                    'The minimum number of epochs that must be run before the early stopping logic can be invoked. It is used only when early_stopping = True.',
            },
            {
                key: 'early_stopping_patience',
                value: ['5'],
                ...staticParameterProperties,
                zValidator: numberValidator('early_stopping_patience',
                    {   
                        min: 1, 
                        max: 1000000
                    }),
                description:
                    'The number of epochs to wait before ending training if no improvement is made in the relevant metric. It is used only when early_stopping = True.',
            },
            {
                key: 'early_stopping_tolerance',
                value: ['0.0'],
                ...staticParameterProperties,
                zValidator: numberValidator('early_stopping_tolerance',
                    {   
                        min: 0, 
                        max: 1,
                        isFloat: true
                    }),
                description:
                    'Used only when early_stopping = True. Relative tolerance to measure an improvement in accuracy validation metric. If the ratio of the improvement in accuracy divided by the previous best accuracy is smaller than the early_stopping_tolerance value set, early stopping considers there is no improvement.',
            },
        ],
    },
    {
        active: true,
        tunable: true,
        displayName: 'Clustering - K-Means',
        name: 'kmeans',
        metadata: kmeansMetadata as AlgorithmMetadata,
        defaultHyperParameters: [
            {
                key: 'k',
                value: [''],
                ...staticParameterProperties,
                description: 'The number of required clusters.',
                zValidator: positiveIntValidator('k', { required: true }),
            },
            {
                key: 'feature_dim',
                value: [''],
                ...staticParameterProperties,
                zValidator: positiveIntValidator('feature_dim', { required: true }),
                description: 'The number of features in the input data.',
            },
            {
                key: 'init_method',
                value: ['random', 'kmeans++'],
                ...categoricalParameterProperties,
                options: ['random', 'kmeans++'],
                description:
                    'Method by which the algorithm chooses the initial cluster centers. The standard k-means approach chooses them at random. An alternative k-means++ method chooses the first cluster center at random. Then it spreads out the position of the remaining initial clusters by weighting the selection of centers with a probability distribution that is proportional to the square of the distance of the remaining data points from existing centers.',
            },
            {
                key: 'mini_batch_size',
                value: ['5000'],
                ...linearIntProperties,
                zValidator: positiveIntValidator('mini_batch_size'),
                description: 'The number of observations per mini-batch for the data iterator.',
            },
            {
                key: 'extra_center_factor',
                value: ['auto'],
                ...integerParameterProperties,
                scalingType: 'Auto',
                zValidator: positiveIntValidator('extra_center_factor', { alternateValues: ['auto'] }), // auto or int
                description:
                    'The algorithm creates K centers = num_clusters * extra_center_factor as it runs and reduces the number of centers from K to k when finalizing the model.',
            },
            {
                key: 'local_lloyd_max_iter',
                value: ['300'],
                ...staticParameterProperties,
                zValidator: positiveIntValidator('local_lloyd_max_iter', { required: true }),
                description:
                    'The maximum number of iterations for Lloyd\'s expectation-maximization (EM) procedure used to build the final model containing k centers.',
            },
            {
                key: 'local_lloyd_tol',
                value: ['0.0001'],
                ...staticParameterProperties,
                zValidator: numberValidator('local_lloyd_tol',
                    {   
                        min: 0, 
                        max: 1,
                        isFloat: true
                    }),
                description:
                    'The tolerance for change in loss for early stopping of Lloyd\'s expectation-maximization (EM) procedure used to build the final model containing k centers.',
            },
            {
                key: 'local_lloyd_init_method',
                value: ['kmeans++'],
                ...staticParameterProperties,
                options: ['random', 'kmeans++'],
                description:
                    'The initialization method for Lloyd\'s expectation-maximization (EM) procedure used to build the final model containing k centers.',
            },
            {
                key: 'local_lloyd_num_trials',
                value: ['auto'],
                ...staticParameterProperties,
                zValidator: positiveIntValidator('local_lloyd_num_trials', { alternateValues: ['auto'] }), // auto or int
                description:
                    'The number of times the Lloyd\'s expectation-maximization (EM) procedure with the least loss is run when building the final model containing k centers.',
            },
            {
                key: 'half_life_time_size',
                value: ['0'],
                ...staticParameterProperties,
                zValidator: numberValidator('half_life_time_size', { min: 0 }),
                description:
                    'Used to determine the weight given to an observation when computing a cluster mean. This weight decays exponentially as more points are observed. When a point is first observed, it is assigned a weight of 1 when computing the cluster mean. The decay constant for the exponential decay function is chosen so that after observing half_life_time_size points, its weight is 1/2. If set to 0, there is no decay.',
            },
            {
                key: 'epochs',
                value: ['1'],
                ...linearIntProperties,
                zValidator: positiveIntValidator('epochs'),
                description: 'The number of passes done over the training data.',
            },
            {
                key: 'eval_metrics',
                value: ['["msd"]'],
                ...staticParameterProperties,
                options: ['["msd"]', '["ssd"]', '["msd", "ssd"]'],
                description:
                    'A JSON list of metric types used to report a score for the model. Allowed values are msd for Means Square Deviation and ssd for Sum of Square Distance. If test data is provided, the score is reported for each of the metrics requested.',
            },
        ],
    },
    {
        active: true,
        tunable: true,
        displayName: 'Time Series Forecast - DeepAR',
        name: 'forecasting-deepar',
        metadata: deepARMetadata as AlgorithmMetadata,
        defaultHyperParameters: [
            {
                key: 'mini_batch_size',
                value: ['128'],
                ...linearIntProperties,
                zValidator: positiveIntValidator('mini_batch_size'),
                description:
                    'The size of mini-batches used during training. Typical values range from 32 to 512.',
            },
            {
                key: 'time_freq',
                value: [''],
                ...staticParameterProperties,
                // A positive int followed by M, W, D, H, or min
                zValidator: z.string().regex(/^\s*([1-9]\d*)?(M|D|W|H|min)\s*$/, {
                    message: 'time_freq must be a positive integer followed by M,D,W,H, or min.',
                }),
                description: (
                    <>
                        The granularity of the time series in the dataset. Use time_freq to select
                        appropriate date features and lags. The model supports the following basic
                        frequencies:
                        <ul>
                            <li>M: monthly</li>
                            <li>W: weekly </li>
                            <li>D: daily</li>
                            <li>H: hourly</li>
                            <li>min: every minute</li>
                        </ul>
                        It also supports multiples of these basic frequencies. For example, 5min
                        specifies a frequency of 5 minutes.
                    </>
                ),
            },
            {
                key: 'early_stopping_patience',
                value: [''],
                ...staticParameterProperties,
                zValidator: positiveIntValidator('early_stopping_patience'),
                description:
                    'If this parameter is set, training stops when no progress is made within the specified number of epochs. The model that has the lowest loss is returned as the final model.',
            },
            {
                key: 'epochs',
                value: [''],
                ...linearIntProperties,
                zValidator: positiveIntValidator('epochs', { required: true }),
                description:
                    'The maximum number of passes over the training data. The optimal value depends on your data size and learning rate. See also early_stopping_patience. Typical values range from 10 to 1000.',
            },
            {
                key: 'context_length',
                value: [''],
                ...linearIntProperties,
                zValidator: positiveIntValidator('context_length', { required: true }),
                description:
                    'The number of time-points that the model gets to see before making the prediction. The value for this parameter should be about the same as the prediction_length. The model also receives lagged inputs from the target, so context_length can be much smaller than typical seasonalities. For example, a daily time series can have yearly seasonality. The model automatically includes a lag of one year, so the context length can be shorter than a year. The lag values that the model picks depend on the frequency of the time series. For example, lag values for daily frequency are previous week, 2 weeks, 3 weeks, 4 weeks, and year.',
            },
            {
                key: 'prediction_length',
                value: [''],
                ...staticParameterProperties,
                zValidator: positiveIntValidator('prediction_length', { required: true }),
                description:
                    'The number of time-steps that the model is trained to predict, also called the forecast horizon. The trained model always generates forecasts with this length. It can\'t generate longer forecasts. The prediction_length is fixed when a model is trained and it cannot be changed later.',
            },
            {
                key: 'num_cells',
                value: ['40'],
                ...linearIntProperties,
                zValidator: positiveIntValidator('num_cells'),
                description:
                    'The number of cells to use in each hidden layer of the RNN. Typical values range from 30 to 100.',
            },
            {
                key: 'num_layers',
                value: ['2'],
                ...linearIntProperties,
                zValidator: positiveIntValidator('num_layers'),
                description:
                    'The number of hidden layers in the RNN. Typical values range from 1 to 4.',
            },
            {
                key: 'num_dynamic_feat',
                value: ['auto'],
                ...staticParameterProperties,
                zValidator: positiveIntValidator('num_dynamic_feat', { alternateValues: ['auto', 'ignore', ''] }), // auto, ignore, positive int, or empty string
                description:
                    'The number of dynamic_feat provided in the data. Set this to auto to infer the number of dynamic features from the data. The auto mode also works when no dynamic features are used in the dataset. This is the recommended setting for the parameter. To force DeepAR to not use dynamic features, even it they are present in the data, set num_dynamic_feat to ignore.To perform additional data validation, it is possible to explicitly set this parameter to the actual integer value. For example, if two dynamic features are provided, set this to 2.',
            },
            {
                key: 'dropout_rate',
                value: ['0.1'],
                ...continuousParameterProperties,
                scalingType: 'Linear',
                zValidator: numberValidator('dropout_rate',
                    {   
                        min: 0, 
                        max: 1,
                        isFloat: true
                    }),
                description:
                    'The dropout rate to use during training. The model uses zoneout regularization. For each iteration, a random subset of hidden neurons are not updated. Typical values are less than 0.2.',
            },
            {
                key: 'cardinality',
                value: ['auto'],
                ...staticParameterProperties,
                zValidator: positiveIntValidator('cardinality', { alternateValues: ['auto', 'ignore', ''] }), // auto, ignore, array of positive integers, empty string, or (?) - This is probably incorrectly implemented right now
                description:
                    'When using the categorical features (cat), cardinality is an array specifying the number of categories (groups) per categorical feature. Set this to auto to infer the cardinality from the data. The auto mode also works when no categorical features are used in the dataset. This is the recommended setting for the parameter. Set cardinality to ignore to force DeepAR to not use categorical features, even it they are present in the data. To perform additional data validation, it is possible to explicitly set this parameter to the actual value. For example, if two categorical features are provided where the first has 2 and the other has 3 possible values, set this to [2, 3]. For more information on how to use categorical feature, see the data-section on the main documentation page of DeepAR.',
            },
            {
                key: 'embedding_dimension',
                value: ['10'],
                ...linearIntProperties,
                zValidator: positiveIntValidator('embedding_dimension'),
                description:
                    'Size of embedding vector learned per categorical feature (same value is used for all categorical features). The DeepAR model can learn group-level time series patterns when a categorical grouping feature is provided. To do this, the model learns an embedding vector of size embedding_dimension for each group, capturing the common properties of all time series in the group. A larger embedding_dimension allows the model to capture more complex patterns. However, because increasing the embedding_dimension increases the number of parameters in the model, more training data is required to accurately learn these parameters. Typical values for this parameter are between 10-100.',
            },
            {
                key: 'learning_rate',
                value: ['0.001'],
                ...continuousParameterProperties,
                scalingType: 'Logarithmic',
                zValidator: numberValidator('learning_rate',
                    {   
                        min: 0, 
                        max: 1,
                        isFloat: true
                    }),
                description:
                    'The learning rate used in training. Typical values range from 1e-4 to 1e-1.',
            },
            {
                key: 'likelihood',
                value: ['student-T', 'gaussian', 'beta', 'negative-binomial', 'deterministic-L1'],
                ...categoricalParameterProperties,
                options: ['student-T', 'gaussian', 'beta', 'negative-binomial', 'deterministic-L1'],
                description: (
                    <>
                        The model generates a probabilistic forecast, and can provide quantiles of
                        the distribution and return samples. Depending on your data, select an
                        appropriate likelihood (noise model) that is used for uncertainty estimates.
                        The following likelihoods can be selected:
                        <ul>
                            <li>gaussian: Use for real-valued data</li>
                            <li>beta: Use for real-valued targets between 0 and 1 inclusive</li>
                            <li>negative-binomial: Use for count data (non-negative integers)</li>
                            <li>
                                student-T: An alternative for real-valued data that works well for
                                bursty data
                            </li>
                            <li>
                                deterministic-L1: A loss function that does not estimate uncertainty
                                and only learns a point forecast
                            </li>
                        </ul>
                    </>
                ),
            },
            {
                key: 'test_quantiles',
                value: ['[0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9]'],
                ...staticParameterProperties,
                zValidator: z.string().regex(/^\s*\[\s*0\.\d+(\s*,\s*0\.\d+)*\s*\]\s*$/, {
                    message: 'test_quantiles must be an array of float values.',
                }),
                description: 'Quantiles for which to calculate quantile loss on the test channel.',
            },
            {
                key: 'num_eval_samples',
                value: ['100'],
                ...staticParameterProperties,
                zValidator: positiveIntValidator('num_eval_samples'),
                description:
                    'The number of samples that are used per time-series when calculating test accuracy metrics. This parameter does not have any influence on the training or the final model. In particular, the model can be queried with a different number of samples. This parameter only affects the reported accuracy scores on the test channel after training. Smaller values result in faster evaluation, but then the evaluation scores are typically worse and more uncertain. When evaluating with higher quantiles, for example 0.95, it may be important to increase the number of evaluation samples.',
            },
        ],
    },
    {
        active: true,
        tunable: false,
        displayName: 'Dimensionality Reduction -  Principal Component Analysis (PCA)',
        name: 'pca',
        metadata: {} as AlgorithmMetadata,
        defaultHyperParameters: [
            {
                key: 'algorithm_mode',
                value: ['regular'],
                ...staticParameterProperties,
                options: ['regular', 'randomized'],
                description:
                    'The training mode (Text Classification) or Word2vec architecture used for training.',
            },
            {
                key: 'num_components',
                value: [''],
                ...staticParameterProperties,
                description: 'The number of principal components to compute.',
                zValidator: positiveIntValidator('num_components', { required: true }),
            },
            {
                key: 'subtract_mean',
                value: ['true'],
                ...staticParameterProperties,
                options: ['true', 'false'],
                description:
                    'Indicates whether the data should be unbiased both during training and at inference. ',
            },
            {
                key: 'extra_components',
                value: ['-1'],
                ...staticParameterProperties,
                description:
                    'As the value increases, the solution becomes more accurate but the runtime and memory consumption increase linearly. The default, -1, means the maximum of 10 and num_components. Valid for randomized mode only.',
                zValidator: z.literal('-1').or(
                    z.preprocess(
                        Number,
                        z
                            .number({
                                invalid_type_error:
                                    'extra_components must be -1 or a non-negative integer',
                            })
                            .min(1, {
                                message: 'extra_components must be -1 or a non-negative integer',
                            })
                            .optional()
                    )
                ),
            },
            {
                key: 'feature_dim',
                value: [''],
                ...staticParameterProperties,
                description: 'Input dimension.',
                zValidator: positiveIntValidator('feature_dim', { required: true }),
            },
            {
                key: 'mini_batch_size',
                value: [''],
                ...staticParameterProperties,
                description: 'Number of rows in a mini-batch.',
                zValidator: positiveIntValidator('mini_batch_size', { required: true }),
            },
        ],
    },
];
