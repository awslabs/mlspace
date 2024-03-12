import { defineConfig } from 'vitepress';

const docItems = [
    {
        text: 'System Administrator Guide',
        items: [
            { text: 'Install Guide', link: '/admin-guide/install' },
            { text: 'Getting Started', link: '/admin-guide/getting-started' },
            { text: 'Setting Initial Admin', link: '/admin-guide/initial-admin' },
            { text: 'Configure AWS Cognito for MLSpace', link: '/admin-guide/configure-cognito' },
        ]
      },
      {
          text: 'Advanced Configuration',
          items: [
            { text: 'Enabling Access To S3 Buckets In MLSpace', link: '/admin-guide/manual-s3-permissions' },
            { text: 'Custom Algorithm Containers In MLSpace', link: '/admin-guide/byom-permissions' },
            { text: 'Branding', link: '/admin-guide/branding' },
          ]
      },
      {
          text: 'User Guide',
          items:[
            {
                text: 'AI/ML Services',
                items: [
                    { text: 'Batch Translation', link: '/user-guide/batch-translation' },
                    { text: 'EMR Clusters', link: '/user-guide/emr-clusters' },
                    { text: 'Endpoints', link: '/user-guide/endpoints' },
                    { text: 'Endpoint Configurations', link: '/user-guide/endpoint-configs' },
                    { text: 'HPO Jobs', link: '/user-guide/hpo-jobs' },
                    { text: 'Labeling Jobs', link: '/user-guide/labeling-jobs' },
                    { text: 'Models', link: '/user-guide/models' },
                    { text: 'Notebooks', link: '/user-guide/notebooks' },
                    { text: 'Real-time Translation', link: '/user-guide/real-time-translation' },
                    { text: 'Training Jobs', link: '/user-guide/training-jobs' },
                ]
            },
            { text: 'Datasets', link: '/user-guide/datasets' },
            { text: 'MLSpace Administration', link: '/user-guide/administration-pages' },
            { text: 'Projects', link: '/user-guide/projects' },
            { text: 'User Preferences', link: '/user-guide/user-preferences' },
          ]
    }
];

// https://vitepress.dev/reference/site-config
export default defineConfig({
    title: 'MLSpace Documentation',
    description: 'A collaborative data science environment',
    outDir: '../public/docs',
    base: process.env.DOCS_BASE_PATH || '/Prod/docs/',
    themeConfig: {
        // https://vitepress.dev/reference/default-theme-config
        nav: [
            { text: 'Home', link: '/' },
            ...docItems
        ],
        sidebar: docItems,
        socialLinks: [
            { icon: 'github', link: 'https://github.com/awslabs/mlspace' }
        ],
        search: {
            provider: 'local'
        }
    }
})
