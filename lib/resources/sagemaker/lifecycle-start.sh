#!/bin/bash
set -x

# MLSpace Default Amazon SageMaker lifecycle configuration
# Configure as a "Start notebook" script
#

# Add the user's key to GitHub config
cat <<END >>/home/ec2-user/.ssh/config
Host github.com
    User git
    Hostname github.com
    PreferredAuthentications publickey
    IdentityFile /home/ec2-user/SageMaker/.ssh/id_rsa.pub
END
ssh-keyscan -H github.com >> /home/ec2-user/.ssh/known_hosts

# Add the user's key to GitLab config
cat <<END >>/home/ec2-user/.ssh/config
Host gitlab.com
    User git
    Hostname gitlab.com
    PreferredAuthentications publickey
    IdentityFile /home/ec2-user/SageMaker/.ssh/id_rsa.pub
END
ssh-keyscan -H gitlab.com >> /home/ec2-user/.ssh/known_hosts

# Add the user's key to Bitbucket config
cat <<END >>/home/ec2-user/.ssh/config
Host bitbucket.com
    User git
    Hostname bitbucket.com
    PreferredAuthentications publickey
    IdentityFile /home/ec2-user/SageMaker/.ssh/id_rsa.pub
END
ssh-keyscan -H bitbucket.com >> /home/ec2-user/.ssh/known_hosts

chown ec2-user:ec2-user /home/ec2-user/.ssh/known_hosts
chown ec2-user:ec2-user /home/ec2-user/.ssh/config
chmod 600 /home/ec2-user/.ssh/config

sudo -u ec2-user -i <<'EOF'
mkdir -p ~/.jupyter/custom
touch ~/.jupyter/custom/custom.css
EOF

cat > /home/ec2-user/.jupyter/custom/custom.css <<'EOF'
#terminado-container {
                height: calc(100% - 2em) !important;
}


EOF

# PLACEHOLDER - ADD high-side specific commands for certificate and external repo configuration

# Reboot the Jupyterhub notebook
systemctl restart jupyter-server