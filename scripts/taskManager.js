let dbOperations = require('../core/databaseOperations');
let res = require('../shared/resources');
let Workflow = require('../core/workflowOperations');
const Util = require('../core/util');

const util = new Util();


module.exports = class taskManager 
{
    constructor()
    {
        this.wf = new Workflow();
    }

    async getAllTaskData()
    {
        const dbOps = new dbOperations();
        let condition = "\"TaskOwner\" = " + "\'"+res["STR_USERID"] +"\'"
        let columnsToFetch = "*"
        let result= await dbOps.getData("View_TaskMaster" , columnsToFetch , condition);
        return result["rows"];
    }

    async getSingleTaskData(userId , taskId)
    {
        const dbOps = new dbOperations();
        let condition = "\"TaskOwner\" = \'" + userId +"\' And \"TaskId\" = \'" + taskId + "\'"
        let columnsToFetch = "*"
        let result= await dbOps.getData("View_TaskMaster" , columnsToFetch , condition);
        return result["rows"];
    }

    async getTaskActivityData(taskId)
    {
        const dbOps = new dbOperations();
        let query = { "TaskId" : taskId }
        let result = await dbOps.getBlobData(res["STR_BLOBDBNAME"] , res["STR_BLOBDBCOLLECTIONAME"] , query);
        return result;
    }

    async getTaskSummaryData()
    {
        const dbOps = new dbOperations();
        let result = {};
        let condition = " \"TaskOwner\" = \'" + res["STR_USERID"]+"\'"
        let totalcount= await dbOps.getData("View_TaskMaster" , "COUNT(*)" ,condition );
        let activeCondition = " \"TaskStatus\" IN ( \'New\' , \'In_Progress\') AND \"TaskOwner\" = \'" + res["STR_USERID"]+"\'";
        let completeCondition = " \"TaskStatus\"  = \'Complete\' AND \"TaskOwner\" = \'" + res["STR_USERID"]+"\'";
        let activeCount= await dbOps.getData("View_TaskMaster" , "COUNT(*)" , activeCondition);
        let completeCount= await dbOps.getData("View_TaskMaster" , "COUNT(*)" , completeCondition);
        result["total"] = totalcount["rows"][0]["count"];
        result["active"] = activeCount["rows"][0]["count"];
        result["complete"] = completeCount["rows"][0]["count"];
        let opt = "GROUP BY \"Module\"";
        let arrColms = [" \"Module\" " , "count(0)"];
        let moduleFragmentationData = await dbOps.getData("View_TaskMaster" ,arrColms , condition , opt);
        result["ModuleData"] = moduleFragmentationData["rows"];
        return result;
    }

    async getTaskVerificationAssignmentSummary()
    {
        const dbOps = new dbOperations();
        let opt = "GROUP BY \"TaskStatus\"";
        let arrColms = [" \"TaskStatus\" " , "count(0)"];
        let condition = " \"TaskAssigner\" = \'" + res["STR_USERID"]+"\'"
        let summaryData = await dbOps.getData("View_TaskMaster" ,arrColms , condition , opt);
        return summaryData["rows"];
    }

    async getTaskVerificationRSCUtilzationData()
    {
        const dbOps = new dbOperations();
        let opt = "GROUP BY \"OwnerName\"";
        let arrColms = [" \"OwnerName\" " , "count(0)"];
        let condition = " \"TaskAssigner\" = \'" + res["STR_USERID"]+"\'"
        let rscData = await dbOps.getData("View_TaskMaster" ,arrColms , condition , opt);
        return rscData["rows"];
    }

    async getTaskVerificationAssignementData()
    {
        const dbOps = new dbOperations();
        let columnsToFetch = [" \"Title\" "," \"DateTerminated\" "," \"TaskStatus\" "," \"OwnerName\" "]
        let condition = " \"TaskAssigner\" = \'" + res["STR_USERID"]+"\'"
        let assignmentData = await dbOps.getData("View_TaskMaster" ,columnsToFetch , condition );
        return assignmentData["rows"];
    }

    async getTaskVerificationCommitData()
    {
        const dbOps = new dbOperations();
        let condition = " \"TaskAssigner\" = \'" + res["STR_USERID"]+"\' AND \"TaskStatus\" = \'" + res["WORKFLOW"]["STR_WF_SELFCOMMIT"] + "\'"
        let arrColumns = [" \"TaskId\" " , " \"Title\" " , " \"Module\" "]
        let result = await dbOps.getData("View_TaskMaster" , arrColumns , condition);
        return result["rows"];
    }

    async getTaskVerificationDeleteData()
    {
        const dbOps = new dbOperations();
        let condition = " \"TaskAssigner\" = \'" + res["STR_USERID"]+"\' AND \"TaskStatus\" = \'" + res["WORKFLOW"]["STR_WF_SELFDELETE"] + "\'"
        let arrColumns = [" \"TaskId\" " , " \"Title\" " , " \"Module\" "]
        let result = await dbOps.getData("View_TaskMaster" , arrColumns , condition);
        return result["rows"];
    }

    async updateNextTaskWorkflowState( tableObject )
    {
        let arrData = tableObject.rows( { selected: true } ).data().toArray();
        const dbOps = new dbOperations();
        let arrColms = [" \"TaskStatus\" "];
        
        for (let index = 0; index < arrData.length; index++) 
        {
            const element = arrData[index];
            console.log(element);
            let taskId = element[7];
            let wfState = await this.wf.getNextWorkflowStatus(element[8]);
            let arrValues = ["\'" + wfState + "\'"];
            let condition = " \"TaskId\" = " + taskId;
            let result = await dbOps.updateData("Task_Master" , arrColms , arrValues , condition)
            console.log(result);

            let query = { "TaskId" : taskId }
            let obj = this.getBlobDocWorkflowUpdateObj(element[8] , wfState)
            let taskData = await dbOps.getBlobData(res["STR_BLOBDBNAME"] , res["STR_BLOBDBCOLLECTIONAME"] , query);
            let activitySet = taskData["Activity"]
            activitySet.push(obj);
            let updateObject = {"Activity" : activitySet , "TaskStatus" : wfState}
            let resultBlob = dbOps.updateBlobData(res["STR_BLOBDBNAME"] , res["STR_BLOBDBCOLLECTIONAME"] , query , updateObject);
            console.log(resultBlob);

        }
    }

    async updateTaskWorkflowStateToSelfCommit(tableObject)
    {
        let arrData = tableObject.rows( { selected: true } ).data().toArray();
        const dbOps = new dbOperations();
        let arrColms = [" \"TaskStatus\" "];
        for (let index = 0; index < arrData.length; index++) 
        {
            const element = arrData[index];
            let taskId = element[7];
            let wfState = res["WORKFLOW"]["STR_WF_SELFCOMMIT"]
            let arrValues = ["\'" + wfState + "\'"];
            let condition = " \"TaskId\" = " + taskId;
            let result = await dbOps.updateData("Task_Master" , arrColms , arrValues , condition)
            console.log(result);

            let query = { "TaskId" : taskId }
            let obj = this.getBlobDocWorkflowUpdateObj(element[8] , wfState)
            let taskData = await dbOps.getBlobData(res["STR_BLOBDBNAME"] , res["STR_BLOBDBCOLLECTIONAME"] , query);
            let activitySet = taskData["Activity"]
            activitySet.push(obj);
            let updateObject = {"Activity" : activitySet , "TaskStatus" : wfState}
            let resultBlob = dbOps.updateBlobData(res["STR_BLOBDBNAME"] , res["STR_BLOBDBCOLLECTIONAME"] , query , updateObject);
            console.log(resultBlob);
        }
    }

    async updateTaskWorkflowStateToSelfDelete(tableObject)
    {
        let arrData = tableObject.rows( { selected: true } ).data().toArray();
        const dbOps = new dbOperations();
        let arrColms = [" \"TaskStatus\" "];
        for (let index = 0; index < arrData.length; index++) 
        {
            const element = arrData[index];
            let taskId = element[7];
            let wfState = res["WORKFLOW"]["STR_WF_SELFDELETE"]
            let arrValues = ["\'" + wfState + "\'"];
            let condition = " \"TaskId\" = " + taskId;
            let result = await dbOps.updateData("Task_Master" , arrColms , arrValues , condition)
            console.log(result);

            let query = { "TaskId" : taskId }
            let obj = this.getBlobDocWorkflowUpdateObj(element[8] , wfState)
            let taskData = await dbOps.getBlobData(res["STR_BLOBDBNAME"] , res["STR_BLOBDBCOLLECTIONAME"] , query);
            let activitySet = taskData["Activity"]
            activitySet.push(obj);
            let updateObject = {"Activity" : activitySet , "TaskStatus" : wfState}
            let resultBlob = dbOps.updateBlobData(res["STR_BLOBDBNAME"] , res["STR_BLOBDBCOLLECTIONAME"] , query , updateObject);
            console.log(resultBlob);
        }
    }

    async TSKV_updateTaskToComplete(taskData)
    {
        console.log(taskData);
        const dbOps = new dbOperations();
        let taskId = taskData[1];
        let arrColms = ["TaskStatus"];
        arrColms = util.generateCustomWrapperArray("\"" , arrColms)
        let wfState = res["WORKFLOW"]["STR_WF_COMPLETE"]
        let arrValues = [wfState];
        arrValues = util.generateCustomWrapperArray("\'" , arrValues)
        let condition = " \"TaskId\" = " + taskId;
        let result = await dbOps.updateData("Task_Master" , arrColms , arrValues , condition)
        console.log(result);

        let query = { "TaskId" : taskId }
        let obj = this.getBlobDocWorkflowUpdateObj(res["WORKFLOW"]["STR_WF_SELFCOMMIT"] , wfState)
        let taskBlobData = await dbOps.getBlobData(res["STR_BLOBDBNAME"] , res["STR_BLOBDBCOLLECTIONAME"] , query);
        let activitySet = taskBlobData["Activity"]
        activitySet.push(obj);
        let updateObject = {"Activity" : activitySet , "TaskStatus" : wfState}
        let resultBlob = dbOps.updateBlobData(res["STR_BLOBDBNAME"] , res["STR_BLOBDBCOLLECTIONAME"] , query , updateObject);
        console.log(resultBlob);
    }

    async TSKV_updateTaskToDelete(taskData)
    {
        console.log(taskData);
        const dbOps = new dbOperations();
        let taskId = taskData[1];
        let arrColms = ["TaskStatus"];
        arrColms = util.generateCustomWrapperArray("\"" , arrColms)
        let wfState = res["WORKFLOW"]["STR_WF_DELETE"]
        let arrValues = [wfState];
        arrValues = util.generateCustomWrapperArray("\'" , arrValues)
        let condition = " \"TaskId\" = " + taskId;
        let result = await dbOps.updateData("Task_Master" , arrColms , arrValues , condition)
        console.log(result);

        let query = { "TaskId" : taskId }
        let obj = this.getBlobDocWorkflowUpdateObj(res["WORKFLOW"]["STR_WF_SELFDELETE"] , wfState)
        let taskBlobData = await dbOps.getBlobData(res["STR_BLOBDBNAME"] , res["STR_BLOBDBCOLLECTIONAME"] , query);
        let activitySet = taskBlobData["Activity"]
        activitySet.push(obj);
        let updateObject = {"Activity" : activitySet , "TaskStatus" : wfState}
        let resultBlob = dbOps.updateBlobData(res["STR_BLOBDBNAME"] , res["STR_BLOBDBCOLLECTIONAME"] , query , updateObject);
        console.log(resultBlob);
    }

    async TSKV_revertTask(taskData)
    {
        console.log(taskData);
        const dbOps = new dbOperations();
        let taskId = taskData[1];
        let arrColms = ["TaskStatus"];
        arrColms = util.generateCustomWrapperArray("\"" , arrColms)
        let wfState = res["WORKFLOW"]["STR_WF_INPROGRESS"]
        let arrValues = [wfState];
        arrValues = util.generateCustomWrapperArray("\'" , arrValues)
        let condition = " \"TaskId\" = " + taskId;
        let result = await dbOps.updateData("Task_Master" , arrColms , arrValues , condition)
        console.log(result);

        let query = { "TaskId" : taskId }
        let taskBlobData = await dbOps.getBlobData(res["STR_BLOBDBNAME"] , res["STR_BLOBDBCOLLECTIONAME"] , query);
        let activitySet = taskBlobData["Activity"]
        let obj = this.getBlobDocWorkflowUpdateObj(taskBlobData["TaskStatus"] , wfState)
        activitySet.push(obj);
        let updateObject = {"Activity" : activitySet , "TaskStatus" : wfState}
        let resultBlob = dbOps.updateBlobData(res["STR_BLOBDBNAME"] , res["STR_BLOBDBCOLLECTIONAME"] , query , updateObject);
        console.log(resultBlob);
    }

    async TSKV_updateTaskToComplete_Multi(tableObject)
    {
        let arrData = tableObject.rows( { selected: true } ).data().toArray();
        console.log(arrData);
        for (let index = 0; index < arrData.length; index++) 
        {
            let data = arrData[index];
            this.TSKV_updateTaskToComplete(data);
        }
    }

    async TSKV_updateTaskToDelete_Multi(tableObject)
    {
        let arrData = tableObject.rows( { selected: true } ).data().toArray();
        console.log(arrData);
        for (let index = 0; index < arrData.length; index++) 
        {
            let data = arrData[index];
            this.TSKV_updateTaskToDelete(data);
        }
    }

    async TSKV_revertTask_Multi(tableObject)
    {
        let arrData = tableObject.rows( { selected: true } ).data().toArray();
        console.log(arrData);
        for (let index = 0; index < arrData.length; index++) 
        {
            let data = arrData[index];
            this.TSKV_revertTask(data);
        }
    }

    // async deleteTask(id)
    // {
    //     const dbOps = new dbOperations();
    //     let condition = " \"TaskId\" = " + id;
    //     let result = dbOps.deleteData("Task_Master" , condition)
    //     return result
    // }

    

    getBlobDocUpdateObj(data)
    {
        let obj = {};
        obj["userNameBy"] = res["STR_USERNAME"]
        obj["userId"] = res["STR_USERID"]
        obj["dateUpdated"] = util.getCurrentDateString();
        obj["updateType"] = "comment"
        obj["activityData"] = data;
        return obj;
    }

    getBlobDocWorkflowUpdateObj(oldWorkflow , newWorkflow)
    {
        let obj = {};
        obj["userNameBy"] = res["STR_USERNAME"]
        obj["userId"] = res["STR_USERID"]
        obj["dateUpdated"] = util.getCurrentDateString();
        obj["updateType"] = "workflow"
        obj["prevWorkflowState"] = oldWorkflow;
        obj["nextWorkflowState"] = newWorkflow;
        return obj;
    }

    getBlobDocFieldUpdateObj(data)
    {
        let obj = {};
        obj["userNameBy"] = res["STR_USERNAME"]
        obj["userId"] = res["STR_USERID"]
        obj["dateUpdated"] = util.getCurrentDateString();
        obj["updateType"] = "field"
        obj["fieldsUpdated"] = {}
        if(Object.keys(data["Project"]).length !== 0 )
        {
            obj["fieldsUpdated"]["Project"] = {}
            obj["fieldsUpdated"]["Project"]["OldProjectId"] = data["Project"]["OldProjectId"]
            obj["fieldsUpdated"]["Project"]["OldProjectName"] = data["Project"]["OldProject"]
            obj["fieldsUpdated"]["Project"]["NewProjectId"] = data["Project"]["NewProjectId"]
            obj["fieldsUpdated"]["Project"]["NewProjectName"] = data["Project"]["NewProject"]
        }
        if(Object.keys(data["Module"]).length !== 0 )
        {
            obj["fieldsUpdated"]["Module"] = {}
            obj["fieldsUpdated"]["Module"]["OldModule"] = data["Module"]["OldModule"]
            obj["fieldsUpdated"]["Module"]["NewModule"] = data["Module"]["NewModule"]
        }
        if(Object.keys(data["Type"]).length !== 0 )
        {
            obj["fieldsUpdated"]["Type"] = {}
            obj["fieldsUpdated"]["Type"]["OldType"] = data["Type"]["OldType"]
            obj["fieldsUpdated"]["Type"]["NewType"] = data["Type"]["NewType"]
        }
        if(Object.keys(data["Priority"]).length !== 0 )
        {
            obj["fieldsUpdated"]["Priority"] = {}
            obj["fieldsUpdated"]["Priority"]["OldPriority"] = data["Priority"]["OldPriority"]
            obj["fieldsUpdated"]["Priority"]["NewPriority"] = data["Priority"]["NewPriority"]
        }
        if(Object.keys(data["OwnerName"]).length !== 0 )
        {
            obj["fieldsUpdated"]["OwnerName"] = {}
            obj["fieldsUpdated"]["OwnerName"]["OldOwner"] = data["OwnerName"]["OldOwner"]
            obj["fieldsUpdated"]["OwnerName"]["OldOwnerId"] = data["OwnerName"]["OldOwnerId"]
            obj["fieldsUpdated"]["OwnerName"]["NewOwner"] = data["OwnerName"]["NewOwner"]
            obj["fieldsUpdated"]["OwnerName"]["NewOwnerId"] = data["OwnerName"]["NewOwnerId"]
        }
        return obj;
    }

    async UpdateBlobTaskWithNewComment(taskId , data)
    {
        let obj = this.getBlobDocUpdateObj(data);
        const dbOps = new dbOperations();
        let query = { "TaskId" : taskId }
        let taskData = await dbOps.getBlobData(res["STR_BLOBDBNAME"] , res["STR_BLOBDBCOLLECTIONAME"] , query);
        console.log(taskData);
        let activitySet = taskData["Activity"]
        activitySet.push(obj);
        let updateObject = {"Activity" : activitySet}
        let result = dbOps.updateBlobData(res["STR_BLOBDBNAME"] , res["STR_BLOBDBCOLLECTIONAME"] , query , updateObject);
        console.log(result);
    }

    async updateTaskFields(data)
    {
        let arrColms = [];
        let arrValues = [];

        if(Object.keys(data["Project"]).length !== 0 )
        {
            arrColms.push("ProjectId");
            arrValues.push(data["Project"]["NewProjectId"]);
        }
        if(Object.keys(data["Module"]).length !== 0 )
        {
            arrColms.push("Module");
            arrValues.push(data["Module"]["NewModule"]);
        }
        if(Object.keys(data["Type"]).length !== 0 )
        {
            arrColms.push("Type");
            arrValues.push(data["Type"]["NewType"]);
        }
        if(Object.keys(data["Priority"]).length !== 0 )
        {
            arrColms.push("Priority");
            arrValues.push(data["Priority"]["NewPriority"]);
        }
        if(Object.keys(data["OwnerName"]).length !== 0 )
        {
            arrColms.push("TaskOwner");
            arrValues.push(data["OwnerName"]["NewOwnerId"]);
        }

        arrColms = util.generateCustomWrapperArray("\"" , arrColms)
        arrValues = util.generateCustomWrapperArray("\'" , arrValues)
        const dbOps = new dbOperations();
        let condition = " \"TaskId\" = " + data["TaskId"];
        let result = await dbOps.updateData("Task_Master" , arrColms , arrValues , condition)

        let obj = this.getBlobDocFieldUpdateObj(data);
        console.log(obj)
        let query = { "TaskId" : data["TaskId"] }
        let taskData = await dbOps.getBlobData(res["STR_BLOBDBNAME"] , res["STR_BLOBDBCOLLECTIONAME"] , query);
        let activitySet = taskData["Activity"]
        activitySet.push(obj);
        let updateObject = {"Activity" : activitySet}
        let resultBlob = dbOps.updateBlobData(res["STR_BLOBDBNAME"] , res["STR_BLOBDBCOLLECTIONAME"] , query , updateObject);
        console.log(resultBlob);
        return result;
    }

}