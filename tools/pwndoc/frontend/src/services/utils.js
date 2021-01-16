export default {
  htmlEncode(html) {
    if(typeof(html) !== "string")  return "";
    
    var result = html
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/&lt;img.+?src="(.*?)".+?alt="(.*?)".*?&gt;/g, '<img src="$1" alt="$2">')
    .replace(/&lt;p&gt;/g, '<p>')
    .replace(/&lt;\/p&gt;/g, '</p>')
    .replace(/&lt;pre&gt;/g, '<pre>')
    .replace(/&lt;\/pre&gt;/g, '</pre>')
    .replace(/&lt;b&gt;/g, '<b>')
    .replace(/&lt;\/b&gt;/g, '</b>')
    .replace(/&lt;strong&gt;/g, '<strong>')
    .replace(/&lt;\/strong&gt;/g, '</strong>')
    .replace(/&lt;i&gt;/g, '<i>')
    .replace(/&lt;\/i&gt;/g, '</i>')
    .replace(/&lt;em&gt;/g, '<em>')
    .replace(/&lt;\/em&gt;/g, '</em>')
    .replace(/&lt;u&gt;/g, '<u>')
    .replace(/&lt;\/u&gt;/g, '</u>')
    .replace(/&lt;s&gt;/g, '<s>')
    .replace(/&lt;\/s&gt;/g, '</s>')
    .replace(/&lt;strike&gt;/g, '<strike>')
    .replace(/&lt;\/strike&gt;/g, '</strike>')
    .replace(/&lt;br&gt;/g, '<br>')
    .replace(/&lt;code&gt;/g, '<code>')
    .replace(/&lt;\/code&gt;/g, '</code>')
    .replace(/&lt;ul&gt;/g, '<ul>')
    .replace(/&lt;\/ul&gt;/g, '</ul>')
    .replace(/&lt;ol&gt;/g, '<ol>')
    .replace(/&lt;\/ol&gt;/g, '</ol>')
    .replace(/&lt;li&gt;/g, '<li>')
    .replace(/&lt;\/li&gt;/g, '</li>')
    .replace(/&lt;h1&gt;/g, '<h1>')
    .replace(/&lt;\/h1&gt;/g, '</h1>')
    .replace(/&lt;h2&gt;/g, '<h2>')
    .replace(/&lt;\/h2&gt;/g, '</h2>')
    .replace(/&lt;h3&gt;/g, '<h3>')
    .replace(/&lt;\/h3&gt;/g, '</h3>')
    .replace(/&lt;h4&gt;/g, '<h4>')
    .replace(/&lt;\/h4&gt;/g, '</h4>')
    .replace(/&lt;h5&gt;/g, '<h5>')
    .replace(/&lt;\/h5&gt;/g, '</h5>')
    .replace(/&lt;h6&gt;/g, '<h6>')
    .replace(/&lt;\/h6&gt;/g, '</h6>')

    return result
  },

  syncEditors: function(refs) {
    // Update all basic-editor when noSync is necessary for performance (text with images). 
    Object.keys(refs).forEach(key => {
        if (key.startsWith('basiceditor_') && refs[key]) // ref must start with 'basiceditor_'
            (Array.isArray(refs[key]))? refs[key].forEach(elt => elt.updateHTML()) : refs[key].updateHTML()
    })
  },

  // Compress images to allow more storage in database since limit in a mongo document is 16MB
  resizeImg: function(imageB64) {
    return new Promise((resolve, reject) => {
      var oldSize = JSON.stringify(imageB64).length
      var max_width = 1920

      var img = new Image()
      img.src = imageB64
      img.onload = function() {
        //scale the image and keep aspect ratio
        var resize_width = (this.width > max_width) ? max_width : this.width
        var scaleFactor =  resize_width / this.width
        var resize_height = this.height * scaleFactor

        // Create a temporary canvas to draw the downscaled image on.
        var canvas = document.createElement("canvas")
        canvas.width = resize_width
        canvas.height = resize_height

        //draw in canvas
        var ctx = canvas.getContext('2d');
        ctx.drawImage(this, 0, 0, resize_width, resize_height)

        var result = canvas.toDataURL('image/jpeg')
        var newSize = JSON.stringify(result).length
        if (newSize >= oldSize)
          resolve(imageB64)
        else
          resolve(result)
      }
    })
  }
}