let firebaseConfig = null;
let auth, db, storage;

async function loadFirebaseConfig(){
  if(firebaseConfig)return firebaseConfig;
  const res=await fetch('/api/firebase-config');
  const config=await res.json();
  if(!res.ok){
    throw new Error(config.error || 'Firebase configuration is missing.');
  }
  firebaseConfig=config;
  return firebaseConfig;
}

async function initFirebase(){
  if(typeof firebase==='undefined'){
    console.error('Firebase SDK not loaded yet');
    return false;
  }
  try{
    const config=await loadFirebaseConfig();
    if(!firebase.apps.length){
      firebase.initializeApp(config);
    }
    auth=firebase.auth();
    db=firebase.firestore();
    storage=firebase.storage();
    console.log('Firebase initialized successfully');
    return true;
  }catch(err){
    console.error('Firebase initialization failed:',err);
    throw err;
  }
}

function motoApp(){
  return {
    page:(document.body.dataset.page || 'splash'), showMenu:false, toasts:[],
    authMode:'login', loginEmail:'', loginPw:'', signupEmail:'', signupPw:'', signupConfirmPw:'',
    showPw:false, showSignupPw:false, loginErr:'', loginLoading:false,
    userName:'Rider', userEmail:'', userPhone:'', profileImg:'https://i.pravatar.cc/150?u=motomatch',
    unitName:'', yearModel:'', unitImg:'https://images.unsplash.com/photo-1558981403-c5f9899a28bc?auto=format&fit=crop&q=80&w=600',
    editModal:false, editName:'', editPhone:'', editUnit:'', editYear:'', editAvatarFile:null, tempImg:null,
    previewUrl:'', previewBase64:'', scanStatus:'idle', previewMimeType:'image/jpeg',
    typedPartName:'', partCategory:'Unknown part', scanMode:'owner',
    cameraActive:false, cameraStream:null,
    scanResult:{partName:'',description:'',compatibility:'',confidence:0,fitmentNotes:[],sdgImpact:'',shopeeUrl:'',lazadaUrl:''},
    scanHistory:[], needItems:[], brokenParts:[], needName:'', needDesc:'', needUrl:'', brokenName:'', brokenImageUrl:'', brokenImageBase64:'', brokenMimeType:'image/jpeg',
    brokenCameraActive:false, brokenCameraStream:null,
    notif:true, emailNotif:true, priceAlert:false, darkMode:true, newPw:'', user:null,

    async init(){
      this.loadLocalState();
      this.applyTheme();
      this.loadNeedDraft();
      this.loadScanDraft();
      if(typeof firebase==='undefined'){
        this.loginErr='Loading Firebase SDK...';
        setTimeout(()=>this.init(),300);
        return;
      }
      try{
        if(!await initFirebase()){
          this.loginErr='Firebase setup is not ready. Check the Vercel environment variables.';
          return;
        }
      }catch(err){
        this.loginErr=err.message||'Firebase setup is not ready. Check the Vercel environment variables.';
        return;
      }
      this.loginErr='';
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
          this.loadLocalState(this.userStateKey());
          try{
            const userDoc=await db.collection('users').doc(user.uid).get();
            if(userDoc.exists){
              const data=userDoc.data();
              Object.assign(this,{
                userName:data.userName||'Rider',
                userPhone:data.userPhone||'',
                profileImg:this.preferSavedImage(data.profileImg,this.profileImg,this.defaultProfileImage()),
                unitName:data.unitName||'',
                yearModel:data.yearModel||'',
                unitImg:this.preferSavedImage(data.unitImg,this.unitImg,this.defaultUnitImage()),
                notif:data.notif!==undefined?data.notif:true,
                emailNotif:data.emailNotif!==undefined?data.emailNotif:true,
                priceAlert:data.priceAlert||false,
                darkMode:data.darkMode!==undefined?data.darkMode:true,
                scanHistory:data.scanHistory||[],
                needItems:data.needItems||[],
                brokenParts:data.brokenParts||[]
              });
            }
            this.saveLocalState();
            this.applyTheme();
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

    userStateKey(){
      return this.user&&this.user.uid?`motomatchState:${this.user.uid}`:'motomatchState';
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
      try{
        const state=JSON.stringify(this.localState());
        localStorage.setItem('motomatchState',state);
        if(this.user&&this.user.uid)localStorage.setItem(this.userStateKey(),state);
      }catch(e){console.warn('Local save failed:',e);}
    },

    loadLocalState(key='motomatchState'){
      try{
        const raw=localStorage.getItem(key);
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
      }catch(e){console.warn('Local load failed:',e);}
      this.applyTheme();
    },

    imageFileToDataUrl(file,maxSize=1200,quality=.82){
      return new Promise((resolve,reject)=>{
        const reader=new FileReader();
        reader.onerror=reject;
        reader.onload=()=>{
          const img=new Image();
          img.onerror=reject;
          img.onload=()=>{
            const ratio=Math.min(1,maxSize/Math.max(img.width,img.height));
            const width=Math.max(1,Math.round(img.width*ratio));
            const height=Math.max(1,Math.round(img.height*ratio));
            const canvas=document.createElement('canvas');
            canvas.width=width;
            canvas.height=height;
            const ctx=canvas.getContext('2d');
            ctx.drawImage(img,0,0,width,height);
            resolve(canvas.toDataURL('image/jpeg',quality));
          };
          img.src=reader.result;
        };
        reader.readAsDataURL(file);
      });
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

    defaultProfileImage(){
      return 'https://i.pravatar.cc/150?u=motomatch';
    },

    defaultUnitImage(){
      return 'https://images.unsplash.com/photo-1558981403-c5f9899a28bc?auto=format&fit=crop&q=80&w=600';
    },

    preferSavedImage(remote,current,defaultValue){
      if(current&&current!==defaultValue&&(!remote||remote===defaultValue))return current;
      return remote||current||defaultValue;
    },

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

    async onBrokenImageSelect(e){
      const f=e.target.files[0];if(!f)return;
      if(f.size>5*1024*1024){this.toast('Image too large. Max 5MB.','error');return;}
      try{
        this.brokenMimeType='image/jpeg';
        this.brokenImageUrl=await this.imageFileToDataUrl(f,1200,.82);
        this.brokenImageBase64=this.brokenImageUrl.split(',')[1];
      }catch(err){
        this.toast('Could not read that image. Try another photo.','error');
      }
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
      this.toast('Broken part saved to your list. Tap it when you are ready to scan.','success');
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
        typedPartName:item.name||'',
        savedPartName:item.name||'',
        autoScan:true
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
        this.typedPartName=draft.typedPartName||draft.savedPartName||this.typedPartName;
        this.scanStatus='idle';
        this.scanResult={partName:'',description:'',compatibility:'',confidence:0,fitmentNotes:[],sdgImpact:'',shopeeUrl:'',lazadaUrl:''};
        if(draft.autoScan&&this.previewBase64){
          this.toast(`${draft.savedPartName||'Saved part'} photo loaded. Scanning now.`, 'info');
          this.$nextTick(()=>this.doScan());
        }else if(draft.savedPartName){
          this.toast(`${draft.savedPartName} photo loaded. Click Scan.`, 'info');
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

    switchAuthMode(mode){
      this.authMode=mode;
      this.loginErr='';
      if(mode==='signup'&&this.loginEmail&&!this.signupEmail){
        this.signupEmail=this.loginEmail;
      }
    },

    passwordStrength(password){
      let score=0;
      if(password.length>=8)score++;
      if(/[A-Z]/.test(password))score++;
      if(/[a-z]/.test(password))score++;
      if(/\d/.test(password))score++;
      if(/[^A-Za-z0-9]/.test(password))score++;
      if(!password)return {label:'Enter a password',className:'empty',score:0};
      if(score<=2)return {label:'Weak password',className:'weak',score};
      if(score<=4)return {label:'Good password',className:'good',score};
      return {label:'Strong password',className:'strong',score};
    },

    defaultUserProfile(user, displayName){
      return {
        userName:displayName,
        userEmail:user.email||'',
        userPhone:'',
        profileImg:user.photoURL||this.profileImg,
        unitName:'',
        yearModel:'',
        unitImg:this.unitImg,
        notif:true,
        emailNotif:true,
        priceAlert:false,
        darkMode:this.darkMode,
        scanHistory:[],
        needItems:[],
        brokenParts:[],
        createdAt:new Date()
      };
    },

    authErrorMessage(err){
      const messages={
        'auth/email-already-in-use':'This email already has an account. Try logging in instead.',
        'auth/invalid-email':'Please enter a valid email address.',
        'auth/invalid-login-credentials':'Email or password is incorrect.',
        'auth/user-not-found':'No account was found for this email.',
        'auth/wrong-password':'Email or password is incorrect.',
        'auth/weak-password':'Password must be at least 6 characters.',
        'auth/operation-not-allowed':'This sign-in method is not enabled in Firebase.',
        'auth/too-many-requests':'Too many attempts. Please wait a moment and try again.',
        'auth/network-request-failed':'Network error. Please check your connection.',
        'permission-denied':'Firebase database permission denied. Check Firestore rules.'
      };
      return messages[err?.code] || err?.message || 'Authentication failed. Please try again.';
    },

    async doLogin(){
      if(!auth){this.loginErr='Firebase not ready';return;}
      const email=this.loginEmail.trim();
      if(!email||!this.loginPw){this.loginErr='Please enter email and password.';return;}
      this.loginLoading=true;
      try{
        await auth.signInWithEmailAndPassword(email,this.loginPw);
        this.loginErr='';
        this.toast('Welcome back!','success');
      }catch(err){
        this.loginErr=this.authErrorMessage(err);
      }finally{
        this.loginLoading=false;
      }
    },

    async doSignUp(){
      if(!auth||!db){this.loginErr='Firebase not ready';return;}
      const email=this.signupEmail.trim();
      if(!email||!this.signupPw||!this.signupConfirmPw){this.loginErr='Please fill in all signup fields.';return;}
      if(this.signupPw.length<6){this.loginErr='Password must be at least 6 characters.';return;}
      if(this.passwordStrength(this.signupPw).className==='weak'){this.loginErr='Please use a stronger password before creating an account.';return;}
      if(this.signupPw!==this.signupConfirmPw){this.loginErr='Passwords do not match.';return;}
      this.loginLoading=true;
      try{
        const credential=await auth.createUserWithEmailAndPassword(email,this.signupPw);
        const user=credential.user;
        const displayName=email.split('@')[0].replace(/[._]/g,' ').replace(/\b\w/g,c=>c.toUpperCase());
        this.userName=displayName;
        this.userEmail=email;
        try{
          await db.collection('users').doc(user.uid).set(this.defaultUserProfile(user,displayName),{merge:true});
        }catch(profileErr){
          console.warn('Account created, but profile save failed:',profileErr);
          this.toast('Account created, but profile sync needs Firebase rules checked.','info');
        }
        this.loginEmail=email;
        this.loginPw='';
        this.signupPw='';
        this.signupConfirmPw='';
        this.loginErr='';
        this.toast('Account created! Welcome to MotoMatch.','success');
      }catch(err){
        this.loginErr=this.authErrorMessage(err);
      }finally{
        this.loginLoading=false;
      }
    },

    async sendPasswordReset(){
      if(!auth){this.loginErr='Firebase not ready';return;}
      const email=this.loginEmail.trim();
      if(!email){this.loginErr='Enter your email first, then click forgot password.';return;}
      this.loginLoading=true;
      try{
        await auth.sendPasswordResetEmail(email,{url:window.location.origin+'/index.html'});
        this.loginErr='';
        this.toast('Password reset email sent. Check your inbox.','success');
      }catch(err){
        this.loginErr=this.authErrorMessage(err);
      }finally{
        this.loginLoading=false;
      }
    },

    async doGoogleAuth(){
      if(!auth||!db){this.loginErr='Firebase not ready';return;}
      this.loginErr='';
      this.loginLoading=true;
      try{
        const provider=new firebase.auth.GoogleAuthProvider();
        provider.setCustomParameters({prompt:'select_account'});
        const credential=await auth.signInWithPopup(provider);
        const user=credential.user;
        if(!user)throw new Error('Google sign-in failed. Please try again.');
        const displayName=user.displayName || (user.email?user.email.split('@')[0]:'Rider');
        const userRef=db.collection('users').doc(user.uid);
        const userDoc=await userRef.get();
        if(!userDoc.exists){
          await userRef.set(this.defaultUserProfile(user,displayName));
        }else{
          await userRef.set({
            userEmail:user.email||userDoc.data().userEmail||'',
            userName:userDoc.data().userName||displayName,
            profileImg:this.preferSavedImage(userDoc.data().profileImg,this.profileImg,user.photoURL||this.defaultProfileImage()),
            lastLoginAt:new Date()
          },{merge:true});
        }
        this.toast('Google sign-in successful!','success');
      }catch(err){
        const messages={
          'auth/popup-closed-by-user':'Google sign-in was cancelled.',
          'auth/popup-blocked':'Popup was blocked. Allow popups for this site and try again.',
          'auth/unauthorized-domain':'This domain is not authorized in Firebase Authentication.',
          'auth/account-exists-with-different-credential':'This email already uses another sign-in method.'
        };
        this.loginErr=messages[err.code]||this.authErrorMessage(err);
      }finally{
        this.loginLoading=false;
      }
    },

    logout(){
      if(!auth){this.page='login';return;}
      auth.signOut().then(()=>{
        window.location.href='index.html';this.loginPw='';this.loginErr='';this.showMenu=false;this.user=null;
        this.toast('Logged out successfully','info');
      }).catch(err=>console.error('Logout failed:',err));
    },

    async onAvatarSelect(e){
      const f=e.target.files[0];if(!f)return;
      if(f.size>5*1024*1024){this.toast('Image too large. Max 5MB.','error');return;}
      try{
        this.editAvatarFile=f;
        const dataUrl=await this.imageFileToDataUrl(f,900,.85);
        this.tempImg=dataUrl;
        this.profileImg=dataUrl;
        this.saveLocalState();
      }catch(err){
        this.editAvatarFile=null;
        this.toast('Could not read that image. Try another photo.','error');
      }
    },

    async onSettingsAvatarSelect(e){
      await this.onAvatarSelect(e);
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

    async onUnitImageSelect(e){
      const f=e.target.files[0];if(!f)return;
      if(f.size>5*1024*1024){this.toast('Image too large. Max 5MB.','error');return;}
      try{
        this.unitImg=await this.imageFileToDataUrl(f,1200,.84);
        this.save();
      }catch(err){
        this.toast('Could not read that image. Try another photo.','error');
        return;
      }
      if(!this.user||!storage){
        this.toast('Motorcycle photo saved on this device.','success');
        return;
      }
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

    async saveEdit(){
      if(this.editName)this.userName=this.editName;
      this.userPhone=this.editPhone;
      this.save();
      if(this.editAvatarFile){
        try{
          await this.uploadAvatar(this.editAvatarFile);
          this.toast('Profile saved!','success');
        }catch(err){
          this.saveLocalState();
          this.toast('Profile saved on this device.','success');
        }finally{
          this.editModal=false;
          this.editAvatarFile=null;
        }
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

    async onFileSelect(e){
      const f=e.target.files[0];if(!f)return;
      try{
        this.previewMimeType='image/jpeg';
        this.previewUrl=await this.imageFileToDataUrl(f,1200,.82);
        this.previewBase64=this.previewUrl.split(',')[1];
        this.scanStatus='idle';this.scanResult={};
        this.toast('Photo uploaded. Click Scan when ready.','success');
      }catch(err){
        this.toast('Could not read that image. Try another photo.','error');
      }
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
      this.stopCamera();this.toast('Photo captured. Click Scan when ready.','success');
    },

    buildSearchQuery(partName){
      const typed=(this.typedPartName||'').trim();
      const part=typed||partName||'motorcycle replacement part';
      return `${this.unitName||'motorcycle'} ${this.yearModel||''} ${part}`.replace(/\s+/g,' ').trim();
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

    buildShopUrlFromQuery(platform, queryText){
      const query=encodeURIComponent((queryText||'').trim());
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

    shoppingLinksFromQuery(query){
      return [
        {label:'Shopee',url:this.buildShopUrlFromQuery('shopee',query),type:'shopee'},
        {label:'Lazada',url:this.buildShopUrlFromQuery('lazada',query),type:'lazada'},
        {label:'Google Shopping',url:this.buildShopUrlFromQuery('google',query),type:'other'},
        {label:'Carousell',url:this.buildShopUrlFromQuery('carousell',query),type:'other'},
        {label:'Facebook Marketplace',url:this.buildShopUrlFromQuery('facebook',query),type:'other'},
        {label:'AliExpress',url:this.buildShopUrlFromQuery('aliexpress',query),type:'other'}
      ];
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
      return this.notFoundScanResult('AI could not identify a specific motorcycle part from this photo. Reupload a clearer picture or type the part name, then scan again.');
    },

    notFoundScanResult(description){
      return {
        status:'fail',
        partName:'Item not found',
        description:description||'MotoMatch could not identify the item in this photo. Reupload and scan again.',
        searchQuery:'',
        compatibility:'Item not found',
        confidence:0,
        fitmentNotes:[
          'Reupload a clearer, well-lit photo.',
          'Make sure the part fills most of the frame.',
          'Type the part name if you know it, then scan again.'
        ],
        sdgImpact:'',
        shopeeUrl:'',
        lazadaUrl:'',
        otherShopLinks:[],
        shopLinks:[]
      };
    },

    normalizeScanResult(data){
      const fallback=this.fallbackScanResult();
      const raw=data&&data.result?data.result:data;
      if(!raw)return fallback;
      const confidence=Number(raw.confidence||0);
      const status=(raw.status||'').toString().toLowerCase();
      const partName=raw.partName||raw.part_name||fallback.partName;
      const searchQuery=raw.searchQuery||raw.search_query||this.buildSearchQuery(partName);
      const nonPartPattern=/paper|document|receipt|book|notebook|page|text|letter|card|poster|screen|person|face|hand|food|bottle/i;
      const unusable=status==='fail'
        || status==='not_a_part'
        || status==='not motorcycle part'
        || /not found/i.test(partName)
        || nonPartPattern.test(partName)
        || nonPartPattern.test(searchQuery)
        || !searchQuery
        || /^(unknown|unclear|part)$/i.test(partName);
      if(unusable){
        const result=this.notFoundScanResult(raw.description);
        result.confidence=confidence;
        result.fitmentNotes=Array.isArray(raw.fitmentNotes)?raw.fitmentNotes:result.fitmentNotes;
        return result;
      }
      const links=this.shoppingLinksFromQuery(searchQuery);
      return {
        status:'found',
        partName,
        description:raw.description||'Part identified. Use the shop links below and compare listing photos before buying.',
        searchQuery,
        compatibility:raw.compatibility||'Shopping links ready',
        confidence,
        fitmentNotes:Array.isArray(raw.fitmentNotes)?raw.fitmentNotes:(Array.isArray(raw.fitment_notes)?raw.fitment_notes:(Array.isArray(raw.buyingTips)?raw.buyingTips:fallback.fitmentNotes)),
        sdgImpact:raw.sdgImpact||raw.sdg_impact||fallback.sdgImpact,
        shopeeUrl:raw.shopeeUrl||links[0].url,
        lazadaUrl:raw.lazadaUrl||links[1].url,
        otherShopLinks:Array.isArray(raw.otherShopLinks)?raw.otherShopLinks:links.slice(2),
        shopLinks:Array.isArray(raw.shopLinks)?raw.shopLinks:links
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
      const scanStartedAt=Date.now();
      const payload={
        image:this.previewBase64,
        mimeType:this.previewMimeType,
        motorcycle:{unitName:this.unitName,yearModel:this.yearModel},
        partCategory:this.partCategory,
        typedPartName:this.typedPartName,
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
        await this.keepScanAnimationVisible(scanStartedAt);
        if(this.scanResult.status==='fail'){
          this.scanStatus='fail';
          this.toast('Item not found. Reupload and scan again.','error');
          return;
        }
        this.scanStatus='found';
        this.saveScanResult(this.scanResult,'found');
        this.toast('Part identified. Shop links are ready.','success');
      }catch(err){
        console.warn('AI route unavailable, using local shopping links:',err);
        this.scanResult=this.fallbackScanResult();
        await this.keepScanAnimationVisible(scanStartedAt);
        this.scanStatus='fail';
        this.toast('Item not found. Reupload and scan again.','error');
      }
    },

    keepScanAnimationVisible(startedAt){
      const elapsed=Date.now()-startedAt;
      const remaining=Math.max(0,900-elapsed);
      return new Promise(resolve=>setTimeout(resolve,remaining));
    }
  };
}
