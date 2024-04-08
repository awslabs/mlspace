enum AuthType {
    Cognito = "COGNITO",
    Idp = "IDP",
};

type ProjectProps = {
    name: string;
    description: string;
};

type DatasetProps = {
    name: string;
    description: string;
    type: 'global' | 'private';
    format: string;
    files: string[];
};


type TestProps = {
    projectPrefix?: string;
    login?: boolean;
    projects?: ProjectProps[];
    datasets?: DatasetProps[];
};

export { ProjectProps, DatasetProps, TestProps, AuthType };