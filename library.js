'use strict';
const routeHelpers=require.main.require('./src/routes/helpers');
const user=require.main.require('./src/user');
const FileManager=require('./lib/file-manager');
const Extra=require('./lib/file-manager-extra');
const plugin={};

async function isAdministrator(req){
    return Boolean(req.uid>0 && await user.isAdministrator(req.uid));
}

plugin.init=async function({router,middleware}){
    routeHelpers.setupAdminPageRoute(router,'/admin/plugins/file-manager',
        [middleware.ensureLoggedIn,async(req,res,next)=>{
            if(!await isAdministrator(req))return res.status(403).send('Forbidden');
            return next();
        }],
        (req,res)=>res.render('admin/plugins/file-manager',{title:'מנהל הקבצים'})
    );
};

plugin.addRoutes=async function({router,middleware,helpers}){
    const adminOnly=[middleware.ensureLoggedIn,async(req,res,next)=>{
        if(!await isAdministrator(req))return helpers.formatApiResponse(403,res,new Error('[[error:no-privileges]]'));
        return next();
    }];
    const endpoint=handler=>async(req,res)=>{
        try{return helpers.formatApiResponse(200,res,await handler(req));}
        catch(err){return helpers.formatApiResponse(err.status||400,res,new Error(err.message||'File manager operation failed'));}
    };
    const get=(route,handler)=>routeHelpers.setupApiRoute(router,'get',route,adminOnly,endpoint(handler));
    const post=(route,handler)=>routeHelpers.setupApiRoute(router,'post',route,adminOnly,endpoint(handler));

    get('/file-manager/list',req=>FileManager.list(req.query.path||''));
    get('/file-manager/read',req=>FileManager.read(req.query.path));
    get('/file-manager/search',req=>Extra.search(req.query.q,req.query.path||''));
    get('/file-manager/backups',()=>Extra.backups());

    post('/file-manager/write',req=>FileManager.write(req.body.path,req.body.content));
    post('/file-manager/mkdir',req=>FileManager.mkdir(req.body.path));
    post('/file-manager/rename',req=>FileManager.rename(req.body.path,req.body.newName));
    post('/file-manager/delete',req=>FileManager.remove(req.body.path));
    post('/file-manager/copy',req=>Extra.copyMove(req.body.path,req.body.destination,false));
    post('/file-manager/move',req=>Extra.copyMove(req.body.path,req.body.destination,true));
    post('/file-manager/upload',req=>{
        let paths=[];
        try{paths=JSON.parse(req.body.relativePaths||'[]');}catch(e){throw new Error('רשימת שמות הקבצים אינה תקינה');}
        return Extra.upload(req.files,paths,req.body.path||'');
    });
    post('/file-manager/extract',req=>Extra.extractZip(req.body.path,req.body.destination||''));
    post('/file-manager/restore',req=>Extra.restore(req.body.id));
};

plugin.addAdminNavigation=function(header){
    header.plugins=header.plugins||[];
    header.plugins.push({route:'/plugins/file-manager',icon:'fa-folder-open',name:'מנהל קבצים'});
    return header;
};
module.exports=plugin;
