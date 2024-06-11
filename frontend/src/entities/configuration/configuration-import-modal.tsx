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
import {
    Box,
    Button,
    Container,
    FileUpload,
    Header,
    Modal,
    SpaceBetween
} from '@cloudscape-design/components';

export type ConfigurationImportModalProps = {
    visible: boolean;
    selectedFile: File[];
    setSelectedFile: (selectedFile: File[]) => void;
    setVisible: (boolean) => void;
    upload: () => void;
};

export function ConfigurationImportModal (props: ConfigurationImportModalProps) {
    return (
        <Modal
            visible={props.visible}
            onDismiss={() => props.setVisible(false)}
            header={<Header>Confirm changes</Header>}
            footer={
                <Box float='right'>
                    <SpaceBetween direction='horizontal' size='xs'>
                        <Button onClick={() => props.setVisible(false)}>Cancel</Button>
                        <Button
                            variant='primary'
                            disabled={props.selectedFile.length === 0}
                            onClick={async () => {
                                props.upload();
                                props.setVisible(false);
                            }
                            }>
                            Upload Configuration
                        </Button>
                    </SpaceBetween>
                </Box>
            }
        >
            <Container
                header={
                    <Header
                        variant='h3'
                        description={`Upload a JSON configuration for ${window.env.APPLICATION_NAME}. This will be parsed for validity and then uploaded as the active configuraion. The import will fail if the provided configuration doesn't have the required values.`}
                    >
                        Import Configuration
                    </Header>
                }
            >
                <SpaceBetween direction='vertical' size='s'>
                    <FileUpload
                        onChange={({ detail }) => {
                            props.setSelectedFile(detail.value);
                        }}
                        value={props.selectedFile}
                        i18nStrings={{
                            uploadButtonText: (e) =>
                                e ? 'Choose files' : 'Choose file',
                            dropzoneText: (e) =>
                                e ? 'Drop files to upload' : 'Drop file to upload',
                            removeFileAriaLabel: (e) => `Remove file ${e + 1}`,
                            limitShowFewer: 'Show fewer files',
                            limitShowMore: 'Show more files',
                            errorIconAriaLabel: 'Error uploading file'
                        }}
                    />
                </SpaceBetween>
            </Container>
        </Modal>
    );
}

export default ConfigurationImportModal;