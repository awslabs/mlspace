#!/bin/bash
set -x

# Configure the default SSH key for external repo configuration and download global resources
mkdir /home/ec2-user/SageMaker/.ssh
mkdir /home/ec2-user/SageMaker/example-repos
mkdir /home/ec2-user/SageMaker/example-repos/github
mkdir /home/ec2-user/SageMaker/example-repos/gitlab
mkdir /home/ec2-user/SageMaker/example-repos/bitbucket
mkdir /home/ec2-user/SageMaker/global-resources
ssh-keygen -f /home/ec2-user/SageMaker/.ssh/id_rsa -N ''
cat /home/ec2-user/SageMaker/.ssh/id_rsa.pub > /home/ec2-user/SageMaker/sagemaker-ssh-pub-key.txt
chmod 600 /home/ec2-user/SageMaker/.ssh/id_rsa
touch /home/ec2-user/.ssh/config

# Create and execute script for retrieving global resources
cat >> /home/ec2-user/SageMaker/get-global-resources.sh << EOF
#!/bin/bash
# Use the AWS S3 sync command to retrieve global resources
aws s3 sync s3://<DATA_BUCKET_NAME>/global-read-only/resources /home/ec2-user/SageMaker/global-resources/
echo "Global resources downloaded and stored in /home/ec2-user/SageMaker/global-resources/ which includes notebook parameters and an example notebook for high-side repo access instructions."
EOF
chmod ugo+x /home/ec2-user/SageMaker/get-global-resources.sh

# Adjust home directory permissions
chown -R ec2-user:ec2-user /home/ec2-user/SageMaker/

# Execute the get global resources script as ec2-user
sudo -u ec2-user -i <<'EOF'
bash /home/ec2-user/SageMaker/get-global-resources.sh
EOF