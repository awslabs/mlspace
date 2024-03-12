import os

from setuptools import find_packages, setup

# Declare your non-python data files:
# Files underneath configuration/ will be copied into the build preserving the
# subdirectory structure if they exist.
data_files = []
for root, dirs, files in os.walk("configuration"):
    data_files.append(
        (os.path.relpath(root, "configuration"), [os.path.join(root, f) for f in files]),
    )

setup(
    name="MLSpaceLambda",
    version="1.0",
    packages=find_packages(where="src", exclude=("test",)),
    package_dir={"": "src"},
    data_files=data_files,
    test_command="pytest",
    doc_command="sphinx",
    check_format="strict",
    test_mypy=False,
    test_flake8=True,
)
