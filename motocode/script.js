// Firebase Configuration
const firebaseConfig = {
  apiKey: "AIzaSyCK3X24HuDH1IggdENSDADU0ubrBsnk_4s",
  authDomain: "matchcodemoto.firebaseapp.com",
  projectId: "matchcodemoto",
  storageBucket: "matchcodemoto.appspot.com",
  messagingSenderId: "864873199872",
  appId: "1:864873199872:web:4e18c4a1526b2ed5bcdbe5",
  measurementId: "G-MLNZV08JRR"
};

let auth, db, storage;
function initFirebase(){
  if(typeof firebase==='undefined'){
    console.error('Firebase SDK not loaded yet');
    return false;
  }
  try{
    if(!firebase.apps.length){
      firebase.initializeApp(firebaseConfig);
    }
    auth=firebase.auth();
    db=firebase.firestore();
    storage=firebase.storage();
    console.log('Firebase initialized successfully');
    return true;
  }catch(err){
    console.error('Firebase initialization failed:',err);
    return false;
  }
}

function motoApp(){
  return {
    page:(document.body.dataset.page || 'splash'), showMenu:false, toasts:[],
    loginEmail:'', loginPw:'', showPw:false, loginErr:'', loginLoading:false,
    userName:'Rider', userEmail:'', userPhone:'', profileImg:'https://i.pravatar.cc/150?u=motomatch',
    unitName:'', yearModel:'', unitImg:'https://images.unsplash.com/photo-1558981403-c5f9899a28bc?auto=format&fit=crop&q=80&w=600',
    editModal:false, editName:'', editPhone:'', editUnit:'', editYear:'', editAvatarFile:null, tempImg:null,
    previewUrl:'', previewBase64:'', scanStatus:'idle', previewMimeType:'image/jpeg',
    partCategory:'Unknown part', scanMode:'owner',
    cameraActive:false, cameraStream:null,
    scanResult:{partName:'',description:'',compatibility:'',confidence:0,fitmentNotes:[],sdgImpact:'',shopeeUrl:'',lazadaUrl:''},
    scanHistory:[], needItems:[], brokenParts:[], needName:'', needDesc:'', needUrl:'', brokenName:'', brokenImageUrl:'', brokenImageBase64:'', brokenMimeType:'image/jpeg',
    brokenCameraActive:false, brokenCameraStream:null,
    notif:true, emailNotif:true, priceAlert:false, darkMode:true, newPw:'', user:null,

    init(){
      this.loadLocalState();
      if(typeof firebase==='undefined'){
        setTimeout(()=>this.init(),300);
        return;
      }
      if(!initFirebase()){
        setTimeout(()=>this.init(),300);
        return;
      }
      // Test storage connection
      if(storage){
        try{
          const testRef=storage.ref();
          console.log('Storage bucket:',testRef.bucket);
          console.log('Firebase Storage ready: true');
        }catch(e){console.error('Storage test failed:',e);}
      }else{
        console.error('Firebase Storage NOT initialized');
      }
      auth.onAuthStateChanged(async(user)=>{
        if(user){
          this.user=user;
          this.userEmail=user.email;
          try{
            const userDoc=await db.collection('users').doc(user.uid).get();
            if(userDoc.exists){
              const data=userDoc.data();
              Object.assign(this,{
                userName:data.userName||'Rider',
                userPhone:data.userPhone||'',
                profileImg:data.profileImg||this.profileImg,
                unitName:data.unitName||'',
                yearModel:data.yearModel||'',
                unitImg:data.unitImg||this.unitImg,
                notif:data.notif!==undefined?data.notif:true,
                emailNotif:data.emailNotif!==undefined?data.emailNotif:true,
                priceAlert:data.priceAlert||false,
                darkMode:data.darkMode!==undefined?data.darkMode:true,
                scanHistory:data.scanHistory||[],
                needItems:data.needItems||[],
                brokenParts:data.brokenParts||[]
              });
            }
            this.applyTheme();
            this.loadNeedDraft();
            this.loadScanDraft();
            this.redirectAfterAuth();
          }catch(e){
            console.error('Error loading user data:',e);
            this.redirectAfterAuth();
          }
        }else{
          this.redirectToLogin();
        }
      });
    },

    save(){
      this.saveLocalState();
      if(!this.user||!db)return;
      db.collection('users').doc(this.user.uid).set({
        userName:this.userName,
        userPhone:this.userPhone,
        profileImg:this.profileImg,
        unitName:this.unitName,
        yearModel:this.yearModel,
        unitImg:this.unitImg,
        notif:this.notif,
        emailNotif:this.emailNotif,
        priceAlert:this.priceAlert,
        darkMode:this.darkMode,
        scanHistory:this.scanHistory,
        needItems:this.needItems,
        brokenParts:this.brokenParts,
        lastUpdated:new Date()
      },{merge:true}).catch(e=>console.error('Save failed:',e));
    },

    localState(){
      return {
        userName:this.userName,
        userPhone:this.userPhone,
        profileImg:this.profileImg,
        unitName:this.unitName,
        yearModel:this.yearModel,
        unitImg:this.unitImg,
        notif:this.notif,
        emailNotif:this.emailNotif,
        priceAlert:this.priceAlert,
        darkMode:this.darkMode,
        scanHistory:this.scanHistory,
        needItems:this.needItems,
        brokenParts:this.brokenParts
      };
    },

    saveLocalState(){
      try{localStorage.setItem('motomatchState',JSON.stringify(this.localState()));}catch(e){}
    },

    loadLocalState(){
      try{
        const raw=localStorage.getItem('motomatchState');
        if(!raw)return;
        const data=JSON.parse(raw);
        Object.assign(this,{
          userName:data.userName||this.userName,
          userPhone:data.userPhone||this.userPhone,
          profileImg:data.profileImg||this.profileImg,
          unitName:data.unitName||this.unitName,
          yearModel:data.yearModel||this.yearModel,
          unitImg:data.unitImg||this.unitImg,
          notif:data.notif!==undefined?data.notif:this.notif,
          emailNotif:data.emailNotif!==undefined?data.emailNotif:this.emailNotif,
          priceAlert:data.priceAlert!==undefined?data.priceAlert:this.priceAlert,
          darkMode:data.darkMode!==undefined?data.darkMode:this.darkMode,
          scanHistory:Array.isArray(data.scanHistory)?data.scanHistory:this.scanHistory,
          needItems:Array.isArray(data.needItems)?data.needItems:this.needItems,
          brokenParts:Array.isArray(data.brokenParts)?data.brokenParts:this.brokenParts
        });
      }catch(e){}
      this.applyTheme();
    },

    go(p){
      const routes={dashboard:'dashboard.html',scanner:'scanner.html',need:'need-to-buy.html',broken:'broken-parts.html',profile:'profile.html',settings:'settings.html',login:'index.html',splash:'index.html'};
      this.showMenu=false;
      if(routes[p]&&this.page!==p){window.location.href=routes[p];return;}
      this.page=p;
    },
    redirectAfterAuth(){
      const current=document.body.dataset.page||'splash';
      if(current==='splash'||current==='login'){
        window.location.href='dashboard.html';
        return;
      }
      this.page=current;
    },
    redirectToLogin(){
      const current=document.body.dataset.page||'splash';
      if(current!=='splash'&&current!=='login'){
        window.location.href='index.html';
        return;
      }
      this.page='login';
    },
    pageTitle(){return {dashboard:'MotoMatch Dashboard',scanner:'Find Parts Online',need:'Need To Buy',broken:'Broken Parts',profile:'Profile',settings:'Settings'}[this.page]||'';},
    removeHistory(id){this.scanHistory=this.scanHistory.filter(item=>item.id!==id);this.save();},

    compatibleCount(){return this.scanHistory.filter(item=>item.compatibility==='Compatible').length;},
    preventedReturns(){return this.scanHistory.length;},
    latestConfidence(){
      if(!this.scanHistory.length)return 0;
      return this.scanHistory[this.scanHistory.length-1].confidence||0;
    },

    cleanUrl(url){
      const value=(url||'').trim();
      if(!value)return '';
      if(/^https?:\/\//i.test(value))return value;
      return 'https://'+value;
    },

    addNeedItem(){
      const name=(this.needName||'').trim();
      const url=this.cleanUrl(this.needUrl);
      if(!name){this.toast('Add an item name first.','error');return;}
      if(!url){this.toast('Paste the Shopee, Lazada, or shop link.','error');return;}
      try{new URL(url);}catch(e){this.toast('Please enter a valid shop link.','error');return;}
      this.needItems.push({
        id:Date.now(),
        name,
        description:(this.needDesc||'').trim(),
        url,
        date:new Date().toLocaleString()
      });
      this.needName='';this.needDesc='';this.needUrl='';
      this.save();
      this.toast('Item saved to Need To Buy.','success');
    },

    removeNeedItem(id){
      this.needItems=this.needItems.filter(item=>item.id!==id);
      this.save();
      this.toast('Item removed.','info');
    },

    openNeedItem(item){
      if(item&&item.url)window.open(item.url,'_blank','noopener');
    },

    onBrokenImageSelect(e){
      const f=e.target.files[0];if(!f)return;
      if(f.size>5*1024*1024){this.toast('Image too large. Max 5MB.','error');return;}
      this.brokenMimeType=f.type||'image/jpeg';
      const r=new FileReader();
      r.onload=ev=>{
        this.brokenImageUrl=ev.target.result;
        this.brokenImageBase64=ev.target.result.split(',')[1];
      };
      r.readAsDataURL(f);
    },

    startBrokenCamera(){
      if(!navigator.mediaDevices||!navigator.mediaDevices.getUserMedia){
        this.toast('Camera is not available in this browser. Use Upload Photo instead.','error');
        return;
      }
      navigator.mediaDevices.getUserMedia({video:{facingMode:'environment',width:{ideal:1280},height:{ideal:720}}})
        .then(stream=>{
          this.brokenCameraStream=stream;
          this.brokenCameraActive=true;
          this.$nextTick(()=>{
            const video=document.getElementById('brokenCameraVideo');
            if(video){video.srcObject=stream;video.play().catch(e=>console.error(e));}
          });
          this.toast('Camera opened.','info');
        })
        .catch(err=>{
          console.error('Broken camera error:',err);
          this.toast('Could not open camera. Check browser camera permission.','error');
        });
    },

    stopBrokenCamera(){
      if(this.brokenCameraStream){
        this.brokenCameraStream.getTracks().forEach(track=>track.stop());
        this.brokenCameraStream=null;
      }
      this.brokenCameraActive=false;
    },

    captureBrokenPhoto(){
      const video=document.getElementById('brokenCameraVideo');
      if(!video){this.toast('Camera preview not ready.','error');return;}
      const canvas=document.createElement('canvas');
      canvas.width=video.videoWidth||1280;
      canvas.height=video.videoHeight||720;
      const ctx=canvas.getContext('2d');
      ctx.drawImage(video,0,0,canvas.width,canvas.height);
      this.brokenImageUrl=canvas.toDataURL('image/jpeg');
      this.brokenImageBase64=this.brokenImageUrl.split(',')[1];
      this.brokenMimeType='image/jpeg';
      this.stopBrokenCamera();
      this.toast('Photo captured.','success');
    },

    addBrokenPart(){
      const name=(this.brokenName||'').trim();
      if(!name){this.toast('Add a broken part name first.','error');return;}
      if(!this.brokenImageUrl){this.toast('Upload or take a picture first.','error');return;}
      const item={
        id:Date.now(),
        name,
        imageUrl:this.brokenImageUrl,
        imageBase64:this.brokenImageBase64,
        mimeType:this.brokenMimeType,
        date:new Date().toLocaleString()
      };
      this.brokenParts.push(item);
      this.brokenName='';this.brokenImageUrl='';this.brokenImageBase64='';this.brokenMimeType='image/jpeg';
      this.stopBrokenCamera();
      this.save();
      this.toast('Broken part saved. Opening scanner.','success');
      this.scanBrokenPart(item);
    },

    removeBrokenPart(id){
      this.brokenParts=this.brokenParts.filter(item=>item.id!==id);
      this.save();
      this.toast('Broken part removed.','info');
    },

    scanBrokenPart(item){
      if(!item||!item.imageUrl)return;
      sessionStorage.setItem('scanDraft',JSON.stringify({
        previewUrl:item.imageUrl,
        previewBase64:item.imageBase64||(item.imageUrl.split(',')[1]||''),
        previewMimeType:item.mimeType||'image/jpeg',
        partCategory:this.guessPartCategory(item.name),
        savedPartName:item.name||''
      }));
      this.go('scanner');
    },

    guessPartCategory(name){
      const value=(name||'').toLowerCase();
      if(value.includes('brake')||value.includes('break pad')||value.includes('pad'))return 'Brake pad';
      if(value.includes('chain')||value.includes('sprocket'))return 'Chain and sprocket';
      if(value.includes('air')&&value.includes('filter'))return 'Air filter';
      if(value.includes('spark')||value.includes('plug'))return 'Spark plug';
      if(value.includes('clutch')||value.includes('cable'))return 'Clutch cable';
      if(value.includes('electrical')||value.includes('wire')||value.includes('light')||value.includes('battery'))return 'Electrical component';
      if(value.includes('fairing')||value.includes('body')||value.includes('panel'))return 'Fairing or body panel';
      return 'Unknown part';
    },

    loadNeedDraft(){
      if((document.body.dataset.page||'')!=='need')return;
      const raw=sessionStorage.getItem('needDraft');
      if(!raw)return;
      try{
        const draft=JSON.parse(raw);
        this.needName=draft.name||'';
        this.needDesc=draft.description||'';
        this.needUrl=draft.url||'';
      }catch(e){}
      sessionStorage.removeItem('needDraft');
    },

    loadScanDraft(){
      if((document.body.dataset.page||'')!=='scanner')return;
      const raw=sessionStorage.getItem('scanDraft');
      if(!raw)return;
      try{
        const draft=JSON.parse(raw);
        this.previewUrl=draft.previewUrl||'';
        this.previewBase64=draft.previewBase64||'';
        this.previewMimeType=draft.previewMimeType||'image/jpeg';
        this.partCategory=draft.partCategory||'Unknown part';
        this.scanStatus='idle';
        this.scanResult={partName:'',description:'',compatibility:'',confidence:0,fitmentNotes:[],sdgImpact:'',shopeeUrl:'',lazadaUrl:''};
        if(draft.savedPartName){
          this.toast(`${draft.savedPartName} photo loaded. Click Find This Part Online.`, 'info');
        }
      }catch(e){}
      sessionStorage.removeItem('scanDraft');
    },

    useScanLink(url){
      sessionStorage.setItem('needDraft',JSON.stringify({
        name:this.scanResult.partName||'Motorcycle part',
        description:this.scanResult.description||'',
        url:url||this.scanResult.shopeeUrl||''
      }));
      this.go('need');
    },

    toast(msg,type='info'){
      const id=Date.now();
      this.toasts.push({id,msg,type});
      setTimeout(()=>{this.toasts=this.toasts.filter(t=>t.id!==id);},3500);
    },

    applyTheme(){
      document.body.classList.toggle('light-mode',!this.darkMode);
    },

    toggleDarkMode(){
      this.darkMode=!this.darkMode;
      this.applyTheme();
      this.save();
    },

    doLogin(){
      if(!auth){this.loginErr='Firebase not ready';return;}
      if(!this.loginEmail||!this.loginPw){this.loginErr='Please enter email and password.';return;}
      this.loginLoading=true;
      auth.signInWithEmailAndPassword(this.loginEmail,this.loginPw)
        .then(()=>{this.loginErr='';this.loginLoading=false;this.toast('Welcome back!','success');})
        .catch(err=>{this.loginErr=err.message||'Login failed';this.loginLoading=false;});
    },

    doSignUp(){
      if(!auth){this.loginErr='Firebase not ready';return;}
      if(!this.loginEmail||!this.loginPw){this.loginErr='Please enter email and password.';return;}
      if(this.loginPw.length<6){this.loginErr='Password must be at least 6 characters.';return;}
      this.loginLoading=true;
      auth.createUserWithEmailAndPassword(this.loginEmail,this.loginPw)
        .then(()=>{
          const uid=auth.currentUser.uid;
          const displayName=this.loginEmail.split('@')[0].replace(/[._]/g,' ').replace(/\b\w/g,c=>c.toUpperCase());
          this.userName=displayName;
          return db.collection('users').doc(uid).set({
            userName:displayName,userEmail:this.loginEmail,userPhone:'',
            profileImg:this.profileImg,unitName:'',yearModel:'',
            notif:true,emailNotif:true,priceAlert:false,scanHistory:[],needItems:[],brokenParts:[],createdAt:new Date()
          });
        })
        .then(()=>{this.loginErr='';this.loginLoading=false;this.toast('Account created! Welcome to MotoMatch.','success');})
        .catch(err=>{this.loginErr=err.message||'Signup failed';this.loginLoading=false;});
    },

    logout(){
      if(!auth){this.page='login';return;}
      auth.signOut().then(()=>{
        window.location.href='index.html';this.loginPw='';this.loginErr='';this.showMenu=false;this.user=null;
        this.toast('Logged out successfully','info');
      }).catch(err=>console.error('Logout failed:',err));
    },

    onAvatarSelect(e){
      const f=e.target.files[0];if(!f)return;
      if(f.size>5*1024*1024){this.toast('Image too large. Max 5MB.','error');return;}
      this.editAvatarFile=f;
      const reader=new FileReader();
      reader.onload=ev=>{this.tempImg=ev.target.result;this.profileImg=ev.target.result;};
      reader.readAsDataURL(f);
    },

    onSettingsAvatarSelect(e){
      this.onAvatarSelect(e);
      const file=e.target.files&&e.target.files[0];
      if(file){
        this.uploadAvatar(file).then(()=>this.toast('Profile picture saved.','success')).catch(()=>{});
      }
    },

    uploadAvatar(file){
      return new Promise((resolve,reject)=>{
        if(!this.user){this.toast('Not logged in.','error');reject('No user');return;}
        if(!storage){this.toast('Storage not ready. Try again.','error');reject('No storage');return;}
        this.toast('Uploading profile photo...','info');
        const storageRef=storage.ref().child('users/'+this.user.uid+'/avatar_'+Date.now());
        const uploadTask=storageRef.put(file);
        uploadTask.on('state_changed',
          null,
          err=>{
            console.error('Avatar upload error:',err);
            const msg=err.code==='storage/unauthorized'?'Upload blocked — check Firebase Storage rules.':err.message||'Upload failed';
            this.toast(msg,'error');reject(err);
          },
          ()=>{
            uploadTask.snapshot.ref.getDownloadURL().then(url=>{
              this.profileImg=url;
              this.tempImg=null;
              this.save();
              resolve(url);
            }).catch(err=>{this.toast('Could not get photo URL','error');reject(err);});
          }
        );
      });
    },

    onUnitImageSelect(e){
      const f=e.target.files[0];if(!f)return;
      if(f.size>5*1024*1024){this.toast('Image too large. Max 5MB.','error');return;}
      if(!this.user){this.toast('Not logged in.','error');return;}
      if(!storage){this.toast('Storage not ready. Try again.','error');return;}
      // Show preview immediately while uploading
      const reader=new FileReader();
      reader.onload=ev=>{this.unitImg=ev.target.result;};
      reader.readAsDataURL(f);
      this.toast('Uploading motorcycle photo...','info');
      const storageRef=storage.ref().child('users/'+this.user.uid+'/unitImg_'+Date.now());
      const uploadTask=storageRef.put(f);
      uploadTask.on('state_changed',
        null,
        err=>{
          console.error('Unit img upload error:',err);
          const msg=err.code==='storage/unauthorized'?'Upload blocked — check Firebase Storage rules.':err.message||'Upload failed';
          this.toast(msg,'error');
        },
        ()=>{
          uploadTask.snapshot.ref.getDownloadURL().then(url=>{
            this.unitImg=url;this.save();this.toast('Motorcycle photo saved!','success');
          }).catch(err=>{this.toast('Photo saved locally but URL failed','error');console.error(err);});
        }
      );
    },

    openEdit(){
      this.editName=this.userName;this.editPhone=this.userPhone;
      this.editAvatarFile=null;this.editModal=true;
    },

    saveEdit(){
      if(this.editName)this.userName=this.editName;
      this.userPhone=this.editPhone;
      this.save();
      if(this.editAvatarFile){
        this.uploadAvatar(this.editAvatarFile).then(()=>{this.editModal=false;this.toast('Profile saved!','success');}).catch(()=>{this.editModal=false;});
      }else{
        this.editModal=false;this.toast('Profile saved!','success');
      }
    },

    changePw(){
      if(!this.newPw||this.newPw.length<6){this.toast('Password must be at least 6 characters.','error');return;}
      if(!auth||!auth.currentUser){this.toast('Not logged in.','error');return;}
      auth.currentUser.updatePassword(this.newPw)
        .then(()=>{this.newPw='';this.toast('Password changed successfully!','success');})
        .catch(err=>{
          if(err.code==='auth/requires-recent-login'){
            this.toast('Please log out and log back in first, then try again.','error');
          }else{
            this.toast(err.message||'Password change failed','error');
          }
        });
    },

    deleteAccount(){
      if(!confirm('Delete your MotoMatch account? This will remove your saved profile, scans, and Need To Buy list.'))return;
      if(!auth||!auth.currentUser){this.toast('Not logged in.','error');return;}
      const currentUser=auth.currentUser;
      const uid=currentUser.uid;
      const finish=()=>currentUser.delete()
        .then(()=>{
          localStorage.removeItem('motomatchState');
          window.location.href='index.html';
        })
        .catch(err=>{
          if(err.code==='auth/requires-recent-login'){
            this.toast('Please log out and log back in first, then delete account.','error');
          }else{
            this.toast(err.message||'Delete account failed.','error');
          }
        });
      if(db){
        db.collection('users').doc(uid).delete().catch(()=>{}).finally(finish);
      }else{
        finish();
      }
    },

    clearHistory(){
      if(!confirm('Clear all scan history? This cannot be undone.'))return;
      this.scanHistory=[];this.save();this.toast('Scan history cleared.','info');
    },

    onFileSelect(e){
      const f=e.target.files[0];if(!f)return;
      this.previewMimeType=f.type||'image/jpeg';
      const r=new FileReader();
      r.onload=ev=>{
        this.previewUrl=ev.target.result;
        this.previewBase64=ev.target.result.split(',')[1];
        this.scanStatus='idle';this.scanResult={};
      };
      r.readAsDataURL(f);
    },

    resetScan(){
      this.scanStatus='idle';this.previewUrl='';this.previewBase64='';this.scanResult={partName:'',description:'',compatibility:'',confidence:0,fitmentNotes:[],sdgImpact:'',shopeeUrl:'',lazadaUrl:''};
    },

    startCamera(){
      const constraints={video:{facingMode:'environment',width:{ideal:1280},height:{ideal:720}}};
      navigator.mediaDevices.getUserMedia(constraints)
        .then(stream=>{
          this.cameraStream=stream;this.cameraActive=true;
          this.$nextTick(()=>{
            const video=document.getElementById('cameraVideo');
            if(video){video.srcObject=stream;video.play().catch(e=>console.error('Play error:',e));}
          });
          this.toast('Camera started','info');
        })
        .catch(err=>{console.error('Camera error:',err);this.toast('Could not access camera. Check permissions.','error');});
    },

    stopCamera(){
      if(this.cameraStream){this.cameraStream.getTracks().forEach(track=>track.stop());this.cameraStream=null;}
      this.cameraActive=false;
    },

    captureFromCamera(){
      const video=document.getElementById('cameraVideo');if(!video)return;
      const canvas=document.createElement('canvas');
      canvas.width=video.videoWidth;canvas.height=video.videoHeight;
      const ctx=canvas.getContext('2d');ctx.drawImage(video,0,0);
      this.previewUrl=canvas.toDataURL('image/jpeg');
      this.previewBase64=this.previewUrl.split(',')[1];
      this.previewMimeType='image/jpeg';
      this.scanStatus='idle';this.scanResult={};
      this.stopCamera();this.toast('Photo captured. Ready to scan.','success');
    },

    buildSearchQuery(partName){
      return `${this.unitName||'motorcycle'} ${this.yearModel||''} ${partName}`.replace(/\s+/g,' ').trim();
    },

    buildShopUrl(platform, partName){
      const query=encodeURIComponent(this.buildSearchQuery(partName));
      const routes={
        shopee:`https://shopee.ph/search?keyword=${query}`,
        lazada:`https://www.lazada.com.ph/catalog/?q=${query}`,
        google:`https://www.google.com/search?tbm=shop&q=${query}`,
        carousell:`https://www.carousell.ph/search/${query}`,
        facebook:`https://www.facebook.com/marketplace/search/?query=${query}`,
        aliexpress:`https://www.aliexpress.com/wholesale?SearchText=${query}`
      };
      return routes[platform]||routes.google;
    },

    shoppingLinks(partName){
      return [
        {label:'Shopee',url:this.buildShopUrl('shopee',partName),type:'shopee'},
        {label:'Lazada',url:this.buildShopUrl('lazada',partName),type:'lazada'},
        {label:'Google Shopping',url:this.buildShopUrl('google',partName),type:'other'},
        {label:'Carousell',url:this.buildShopUrl('carousell',partName),type:'other'},
        {label:'Facebook Marketplace',url:this.buildShopUrl('facebook',partName),type:'other'},
        {label:'AliExpress',url:this.buildShopUrl('aliexpress',partName),type:'other'}
      ];
    },

    fallbackScanResult(){
      const model=this.unitName||'saved motorcycle model';
      const year=this.yearModel||'selected year model';
      const category=this.partCategory==='Unknown part'?'motorcycle replacement part':this.partCategory;
      const confidence=this.unitName&&this.yearModel?86:68;
      const links=this.shoppingLinks(category);
      return {
        partName:category,
        description:`The image appears to show a ${category.toLowerCase()}. Use the links below to search stores for ${model} ${year} ${category}.`,
        searchQuery:this.buildSearchQuery(category),
        compatibility:'Shopping links ready',
        confidence,
        fitmentNotes:[
          'Shopee and Lazada are checked first through store search links.',
          'If those do not show the exact part, try the other online shop links.',
          this.unitName&&this.yearModel?`Search is filtered with ${model} ${year}.`:'Add your motorcycle unit and year to make the search more specific.'
        ],
        sdgImpact:'',
        shopeeUrl:links[0].url,
        lazadaUrl:links[1].url,
        otherShopLinks:links.slice(2),
        shopLinks:links
      };
    },

    normalizeScanResult(data){
      const fallback=this.fallbackScanResult();
      const raw=data&&data.result?data.result:data;
      if(!raw)return fallback;
      return {
        partName:raw.partName||raw.part_name||fallback.partName,
        description:raw.description||fallback.description,
        searchQuery:raw.searchQuery||raw.search_query||fallback.searchQuery,
        compatibility:raw.compatibility||'Shopping links ready',
        confidence:Number(raw.confidence||fallback.confidence),
        fitmentNotes:Array.isArray(raw.fitmentNotes)?raw.fitmentNotes:(Array.isArray(raw.fitment_notes)?raw.fitment_notes:(Array.isArray(raw.buyingTips)?raw.buyingTips:fallback.fitmentNotes)),
        sdgImpact:raw.sdgImpact||raw.sdg_impact||fallback.sdgImpact,
        shopeeUrl:raw.shopeeUrl||fallback.shopeeUrl,
        lazadaUrl:raw.lazadaUrl||fallback.lazadaUrl,
        otherShopLinks:Array.isArray(raw.otherShopLinks)?raw.otherShopLinks:fallback.otherShopLinks,
        shopLinks:Array.isArray(raw.shopLinks)?raw.shopLinks:fallback.shopLinks
      };
    },

    saveScanResult(result,status='found'){
      const item={
        id:Date.now(),
        partName:result.partName,
        date:new Date().toLocaleString(),
        status,
        compatibility:result.compatibility,
        confidence:result.confidence,
        searchQuery:result.searchQuery,
        imageUrl:this.previewUrl,
        shopeeUrl:result.shopeeUrl,
        lazadaUrl:result.lazadaUrl,
        otherShopLinks:result.otherShopLinks||[],
        today:true
      };
      this.scanHistory.push(item);
      this.save();
    },

    async doScan(){
      if(!this.previewBase64){this.toast('Upload or capture a part photo first.','error');return;}
      this.scanStatus='scanning';
      const payload={
        image:this.previewBase64,
        mimeType:this.previewMimeType,
        motorcycle:{unitName:this.unitName,yearModel:this.yearModel},
        partCategory:this.partCategory,
        mode:this.scanMode
      };
      try{
        const res=await fetch('/api/chat',{
          method:'POST',
          headers:{'Content-Type':'application/json'},
          body:JSON.stringify(payload)
        });
        if(!res.ok)throw new Error('API Error: '+res.status);
        const data=await res.json();
        this.scanResult=this.normalizeScanResult(data);
        this.scanStatus='found';
        this.saveScanResult(this.scanResult,'found');
        this.toast('Part identified. Shop links are ready.','success');
      }catch(err){
        console.warn('AI route unavailable, using local shopping links:',err);
        this.scanResult=this.fallbackScanResult();
        this.scanStatus='found';
        this.saveScanResult(this.scanResult,'found');
        this.toast('Could not reach live AI, but shopping links were generated.','info');
      }
    }
  };
}
