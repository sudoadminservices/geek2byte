var mongoose = require('mongoose');//.set('debug', true);
var Schema = mongoose.Schema;

var Paragraph = {
    text:   String,
    images: [{image: String, caption: String}]
}

var customField = {
    _id:        false,
    label:      String,
    fieldType:  String,
    text:       String
}

var Finding = {
    id:                     Schema.Types.ObjectId,
    identifier:             Number, //incremental ID to be shown in the report
    title:                  String,
    vulnType:               String,
    description:            String,
    observation:            String,
    remediation:            String,
    remediationComplexity:  {type: Number, enum: [1,2,3]},
    priority:               {type: Number, enum: [1,2,3,4]},
    references:             [String],
    cvssv3:                 String,
    cvssScore:              String,
    cvssSeverity:           String,
    paragraphs:             [Paragraph],
    poc:                    String,
    scope:                  String,
    status:                 {type: Number, enum: [0,1], default: 1}, // 0: done, 1: redacting
    category:               String,
    resolution:             String,
    customFields:           [customField]
}

var Service = {
    port:       Number,
    protocol:   {type: String, enum: ['tcp', 'udp']},
    name:       String,
    product:    String,
    version:    String
}

var Host = {
    hostname:   String,
    ip:         String,
    os:         String,
    services:   [Service]
}

var AuditSchema = new Schema({
    name:               {type: String, required: true},
    auditType:          String,
    location:           String,
    date:               String,
    date_start:         String,
    date_end:           String,
    summary:            String,
    company:            {type: Schema.Types.ObjectId, ref: 'Company'},
    client:             {type: Schema.Types.ObjectId, ref: 'Client'},
    collaborators:      [{type: Schema.Types.ObjectId, ref: 'User'}],
    language:           {type: String, required: true},
    idPrefix:           {type:String, default: "#"},
    scope:              [{_id: false, name: String, hosts: [Host]}],
    findings:           [Finding],
    template:           {type: Schema.Types.ObjectId, ref: 'Template'},
    creator:            {type: Schema.Types.ObjectId, ref: 'User'},
    sections:           [{field: String, name: String, text: String}]

}, {timestamps: true});

/*
*** Statics ***
*/

// Get all audits (admin)
AuditSchema.statics.getAudits = (isAdmin, userId, filters) => {
    return new Promise((resolve, reject) => { 
        var query = Audit.find(filters)
        if (!isAdmin)
            query.or([{creator: userId}, {collaborators: userId}])
        query.populate('creator', '-_id username')
        query.populate('collaborators', '-_id username')
        query.populate('company', '-_id name')
        query.select('id name language creator collaborators company createdAt')
        query.exec()
        .then((rows) => {
            resolve(rows)
        })
        .catch((err) => {
            reject(err)
        })
    })
}

// Get Audit with ID to generate report
AuditSchema.statics.getAudit = (isAdmin, auditId, userId) => {
    return new Promise((resolve, reject) => {
        var query = Audit.findById(auditId)
        if (!isAdmin)
            query.or([{creator: userId}, {collaborators: userId}])
        query.populate('template')
        query.populate('creator', 'username firstname lastname role')
        query.populate('company')
        query.populate('client')
        query.populate('collaborators', 'username firstname lastname role')
        query.exec()
        .then((row) => {
            if (!row)
                throw({fn: 'NotFound', message: 'Audit not found'})

            resolve(row)
        })
        .catch((err) => {
            if (err.name === "CastError")
                reject({fn: 'BadParameters', message: 'Bad Audit Id'})
            else
                reject(err)
        })
    })
}

// Create audit
AuditSchema.statics.create = (audit, userId) => {
    return new Promise((resolve, reject) => {
        audit.creator = userId
        var Template = mongoose.model('Template')
        var query = Template.findById(audit.template)
        return query.exec()
        .then((row) => {
            if (row) {
                return new Audit(audit).save()              
            }
            else
                throw({fn: 'NotFound', message: 'Template not found'})
        })
        .then((rows) => {
            resolve(rows)
        })
        .catch((err) => {
            if (err.name === "ValidationError")
                reject({fn: 'BadParameters', message: 'Audit validation failed'})
            else
                reject(err)
        })
    })
}

// Delete audit
AuditSchema.statics.delete = (isAdmin, auditId, userId) => {
    return new Promise((resolve, reject) => {
        var query = Audit.findOneAndRemove({_id: auditId})
        if (!isAdmin)
            query.or([{creator: userId}])
        return query.exec()               
        .then((row) => {
            if (!row)
                throw({fn: 'NotFound', message: 'Audit not found'})
            
            resolve(row)
        })
        .catch((err) => {
            reject(err)
        })
    })
}

// Get audit general information
AuditSchema.statics.getGeneral = (isAdmin, auditId, userId) => {
    return new Promise((resolve, reject) => { 
        var query = Audit.findById(auditId);
        if (!isAdmin)
            query.or([{creator: userId}, {collaborators: userId}])
        query.populate({
            path: 'client', 
            select: 'email firstname lastname', 
            populate: {
                path: 'company', 
                select: 'name'}
            });
        query.populate('collaborators', 'username firstname lastname')
        query.populate('company')
        query.select('id name auditType location date date_start date_end client collaborators language scope.name template idPrefix')
        query.exec()
        .then((row) => {
            if (!row)
                throw({fn: 'NotFound', message: 'Audit not found'});

            var formatScope = row.scope.map(item => {return item.name})
            for (var i=0;i<formatScope.length;i++) {
                row.scope[i] = formatScope[i]
            }
            resolve(row)
        })
        .catch((err) => {
            reject(err)
        })
    })
}

// Update audit general information
AuditSchema.statics.updateGeneral = (isAdmin, auditId, userId, update) => {
    return new Promise((resolve, reject) => { 
        var query = Audit.findByIdAndUpdate(auditId, update)
        if (!isAdmin)
            query.or([{creator: userId}, {collaborators: userId}])
        query.exec()
        .then(row => {
            if (!row)
                throw({fn: 'NotFound', message: 'Audit not found'})
            
            resolve("Audit General updated successfully")
        })
        .catch((err) => {
            reject(err)
        })
    })
}

// Get audit Network information
AuditSchema.statics.getNetwork = (isAdmin, auditId, userId) => {
    return new Promise((resolve, reject) => { 
        var query = Audit.findById(auditId)
        if (!isAdmin)
            query.or([{creator: userId}, {collaborators: userId}])
        query.select('scope')
        query.exec()
        .then((row) => {
            if (!row)
                throw({fn: 'NotFound', message: 'Audit not found'})
            
            resolve(row)
        })
        .catch((err) => {
            reject(err)
        })
    })
}

// Update audit Network information
AuditSchema.statics.updateNetwork = (isAdmin, auditId, userId, scope) => {
    return new Promise((resolve, reject) => { 
        var query = Audit.findByIdAndUpdate(auditId, scope)
        if (!isAdmin)
            query.or([{creator: userId}, {collaborators: userId}])
        query.exec()
        .then(row => {
            if (!row)
                throw({fn: 'NotFound', message: 'Audit not found'})

            resolve("Audit Network updated successfully")
        })
        .catch((err) => {
            reject(err)
        })
    })
}

// Create finding
AuditSchema.statics.createFinding = (isAdmin, auditId, userId, finding) => {
    return new Promise((resolve, reject) => { 
            Audit.getLastFindingIdentifier(auditId).then(identifier => {
                finding.identifier = ++identifier;
                
                var query = Audit
                    .findByIdAndUpdate(auditId, {$push: {findings: {$each: [finding], $sort: {cvssScore: -1}}}})
                    .collation({locale: "en_US", numericOrdering: true})
                if (!isAdmin)
                    query.or([{creator: userId}, {collaborators: userId}])
                query.exec()
                .then(row => {
                    if (!row)
                        throw({fn: 'NotFound', message: 'Audit not found'})

                    resolve("Audit Finding created successfully")
                })
                .catch((err) => {
                    reject(err)
                })
            })
    })
}

AuditSchema.statics.getLastFindingIdentifier = (auditId) => {
    return new Promise((resolve, reject) => {
        Audit.findById(auditId)
            .select('findings.identifier', )
            .sort({'findings.identifier': -1})
            .exec()
            .then(row => {
                if (!row)
                    throw ({ fn: 'NotFound', message: 'Audit not found' })

                var identifier = row.findings.length == 0 ? 0: Math.max(...row.findings.map(r =>  {return r.identifier || 0}))
                resolve(identifier);
            })
            .catch((err) => {
                reject(err);
            })

    });
};


// Get findings list titles
AuditSchema.statics.getFindings = (isAdmin, auditId, userId) => {
    return new Promise((resolve, reject) => { 
        var query = Audit.findById(auditId)
        if (!isAdmin)
            query.or([{creator: userId}, {collaborators: userId}])
        query.select('-_id findings._id findings.title findings.cvssSeverity findings.cvssScore findings.resolution');
        query.sort({'findings.cvssScore': -1})
        query.exec()
        .then((row) => {
            if (!row)
                throw({fn: 'NotFound', message: 'Audit not found'})

            resolve(row)
        })
        .catch((err) => {
            reject(err)
        })
    })
}

// Get finding of audit
AuditSchema.statics.getFinding = (isAdmin, auditId, userId, findingId) => {
    return new Promise((resolve, reject) => { 
        var query = Audit.findById(auditId)
        if (!isAdmin)
            query.or([{creator: userId}, {collaborators: userId}])
        query.select('findings')
        query.exec()
        .then((row) => {
            if (!row)
                throw({fn: 'NotFound', message: 'Audit not found'})

            var finding = row.findings.id(findingId)
            if (finding === null) 
                throw({fn: 'NotFound', message: 'Finding not found'})
            else 
                resolve(finding)
        })
        .catch((err) => {
            reject(err)
        })
    })
}

// Update finding of audit
AuditSchema.statics.updateFinding = (isAdmin, auditId, userId, findingId, newFinding) => {
    return new Promise((resolve, reject) => { 
        var query = Audit.findById(auditId)
        if (!isAdmin)
            query.or([{creator: userId}, {collaborators: userId}])
        query.exec()
        .then((row) => {
            if (!row)
                throw({fn: 'NotFound', message: 'Audit not found'})

            var finding = row.findings.id(findingId)
            if (finding === null)
                reject({fn: 'NotFound', message: 'Finding not found'})         
            else {
                Object.keys(newFinding).forEach((key) => {
                    if(key !== "identifier") // identifier field should not be updatable
                    finding[key] = newFinding[key]
                })
                return row.save({ validateBeforeSave: false }) // Disable schema validation since scope changed from Array to String
            } 
        })
        .then(() => {
            return Audit
            .findByIdAndUpdate(auditId, {$push: {findings: {$each: [], $sort: {cvssScore: -1}}}})
            .collation({locale: "en_US", numericOrdering: true})
        })
        .then(() => {
            resolve("Audit Finding updated successfully")        
        })
        .catch((err) => {
            reject(err)
        })
    })
}

// Delete finding of audit
AuditSchema.statics.deleteFinding = (isAdmin, auditId, userId, findingId) => {
    return new Promise((resolve, reject) => { 
        var query = Audit.findById(auditId)
        if (!isAdmin)
            query.or([{creator: userId}, {collaborators: userId}])
        query.select('findings')
        query.exec()
        .then((row) => {
            if (!row)
                throw({fn: 'NotFound', message: 'Audit not found'})

            var finding = row.findings.id(findingId)
            if (finding === null) reject({fn: 'NotFound', message: 'Finding not found'})
            else {
                row.findings.pull(findingId)
                return row.save()
            }
        })
        .then(() => {
            resolve("Audit Finding deleted successfully")
        })
        .catch((err) => {
            reject(err)
        })
    })
}

// Get audit Summary
AuditSchema.statics.getSummary = (isAdmin, auditId, userId) => {
    return new Promise((resolve, reject) => { 
        var query = Audit.findById(auditId)
        if (!isAdmin)
            query.or([{creator: userId}, {collaborators: userId}])
        query.select('id summary')
        query.exec()
        .then((row) => {
            if (!row)
                throw({fn: 'NotFound', message: 'Audit not found'})

            resolve(row)
        })
        .catch((err) => {
            reject(err)
        })
    })
}

// Update audit Summary
AuditSchema.statics.updateSummary = (isAdmin, auditId, userId, update) => {
    return new Promise((resolve, reject) => { 
        var query = Audit.findByIdAndUpdate(auditId, update)
        if (!isAdmin)
            query.or([{creator: userId}, {collaborators: userId}])
        query.exec()
        .then((row) => {
            if (!row)
                throw({fn: 'NotFound', message: 'Audit not found'})

            resolve(row)
        })
        .catch((err) => {
            reject(err)
        })
    })
}

// Create section
AuditSchema.statics.createSection = (isAdmin, auditId, userId, section) => {
    return new Promise((resolve, reject) => { 
        var query = Audit.findOneAndUpdate({_id: auditId, 'sections.field': {$ne: section.field}}, {$push: {sections: section}})
        if (!isAdmin)
            query.or([{creator: userId}, {collaborators: userId}])
        query.exec()
        .then((row) => {
            if (!row)
                throw({fn: 'NotFound', message: 'Audit not found or Section already exists'})
            
            resolve('Audit Section created successfully')
        })
        .catch((err) => {
            reject(err)
        })
    })
}

// Get section of audit
AuditSchema.statics.getSection = (isAdmin, auditId, userId, sectionId) => {
    return new Promise((resolve, reject) => { 
        var query = Audit.findById(auditId)
        if (!isAdmin)
            query.or([{creator: userId}, {collaborators: userId}])
        query.select('sections')
        query.exec()
        .then((row) => {
            if (!row)
                throw({fn: 'NotFound', message: 'Audit not found'})

            var section = row.sections.id(sectionId);
            if (section === null) 
                throw({fn: 'NotFound', message: 'Section id not found'});
            else 
                resolve(section);
        })
        .catch((err) => {
            reject(err)
        })
    })
}

// Update section of audit
AuditSchema.statics.updateSection = (isAdmin, auditId, userId, sectionId, newSection) => {
    return new Promise((resolve, reject) => { 
        var query = Audit.findById(auditId)
        if (!isAdmin)
            query.or([{creator: userId}, {collaborators: userId}])
        query.exec()
        .then((row) => {
            if (!row)
                throw({fn: 'NotFound', message: 'Audit not found'})
            
            var section = row.sections.id(sectionId)
            if (section === null)
                throw({fn: 'NotFound', message: 'Section not found'})          
            else {
                Object.keys(newSection).forEach((key) => {
                    section[key] = newSection[key]
                })
                return row.save()
            } 
        })
        .then(() => {
            resolve('Audit Section updated successfully')        
        })
        .catch((err) => {
            reject(err)
        })
    })
}

// Delete section of audit
AuditSchema.statics.deleteSection = (isAdmin, auditId, userId, sectionId) => {
    return new Promise((resolve, reject) => { 
        var query = Audit.findById(auditId)
        if (!isAdmin)
            query.or([{creator: userId}, {collaborators: userId}])
        query.select('sections')
        query.exec()
        .then((row) => {
            if (!row)
                throw({fn: 'NotFound', message: 'Audit not found'})

            var section = row.sections.id(sectionId)
            if (section === null) throw({fn: 'NotFound', message: 'Section not found'})
            else {
                row.sections.pull(sectionId)
                return row.save()
            }
        })
        .then(() => {
            resolve('Audit Section deleted successfully')
        })
        .catch((err) => {
            reject(err)
        })
    })
}

/*
*** Methods ***
*/

var Audit = mongoose.model('Audit', AuditSchema);
// Audit.syncIndexes()
module.exports = Audit;