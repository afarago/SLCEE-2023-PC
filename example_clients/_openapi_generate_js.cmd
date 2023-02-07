@cls
@echo ================
cd javascript

@echo Generating client lib
cmd /c openapi-generator-cli generate -i http://localhost:8080/swagger.json -g javascript -o ./lib --global-property=apiTests=false,modelTests=false,modelDocs=false,apiDocs=false --additional-properties=usePromises=true

@echo Installing lib
npm install ./lib

cd ..
